const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    }
  }

  async sendEmail(to, subject, html, text = '') {
    if (!this.transporter) {
      console.warn('Email service not configured. Skipping email send.');
      return false;
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        html,
        text,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  async sendCaseStatusNotification(user, caseData, statusChange) {
    const { fromStatus, toStatus, comments } = statusChange;
    
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

    const subject = `Case ${caseData.case_number} - Status Update: ${statusLabels[toStatus]}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #008B8B; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .case-info { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #008B8B; }
          .status-change { background-color: #e8f5e8; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #008B8B; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Baaseteen Case Management System</h1>
            <h2>Case Status Update</h2>
          </div>
          
          <div class="content">
            <p>Dear ${user.first_name} ${user.last_name},</p>
            
            <p>A case you are involved with has been updated:</p>
            
            <div class="case-info">
              <h3>Case Information</h3>
              <p><strong>Case Number:</strong> ${caseData.case_number}</p>
              <p><strong>Applicant:</strong> ${caseData.applicant_first_name} ${caseData.applicant_last_name}</p>
              <p><strong>ITS Number:</strong> ${caseData.its_number}</p>
              <p><strong>Case Type:</strong> ${caseData.case_type.toUpperCase()}</p>
            </div>
            
            <div class="status-change">
              <h3>Status Change</h3>
              <p><strong>From:</strong> ${statusLabels[fromStatus] || 'N/A'}</p>
              <p><strong>To:</strong> ${statusLabels[toStatus]}</p>
              ${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ''}
            </div>
            
            <p>Please log in to the system to view more details and take any required actions.</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/cases/${caseData.id}" class="button">View Case Details</a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated notification from the Baaseteen Case Management System.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Case Status Update - Baaseteen CMS
      
      Dear ${user.first_name} ${user.last_name},
      
      A case you are involved with has been updated:
      
      Case Number: ${caseData.case_number}
      Applicant: ${caseData.applicant_first_name} ${caseData.applicant_last_name}
      ITS Number: ${caseData.its_number}
      Case Type: ${caseData.case_type.toUpperCase()}
      
      Status Change:
      From: ${statusLabels[fromStatus] || 'N/A'}
      To: ${statusLabels[toStatus]}
      ${comments ? `Comments: ${comments}` : ''}
      
      Please log in to the system to view more details.
      ${process.env.FRONTEND_URL}/cases/${caseData.id}
      
      This is an automated notification from the Baaseteen Case Management System.
    `;

    return await this.sendEmail(user.email, subject, html, text);
  }

  async sendCaseAssignmentNotification(user, caseData, assignedBy) {
    const subject = `New Case Assignment - ${caseData.case_number}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #008B8B; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .case-info { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #008B8B; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #008B8B; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Baaseteen Case Management System</h1>
            <h2>New Case Assignment</h2>
          </div>
          
          <div class="content">
            <p>Dear ${user.first_name} ${user.last_name},</p>
            
            <p>You have been assigned to a new case:</p>
            
            <div class="case-info">
              <h3>Case Information</h3>
              <p><strong>Case Number:</strong> ${caseData.case_number}</p>
              <p><strong>Applicant:</strong> ${caseData.applicant_first_name} ${caseData.applicant_last_name}</p>
              <p><strong>ITS Number:</strong> ${caseData.its_number}</p>
              <p><strong>Case Type:</strong> ${caseData.case_type.toUpperCase()}</p>
              <p><strong>Assigned by:</strong> ${assignedBy.first_name} ${assignedBy.last_name}</p>
            </div>
            
            <p>Please log in to the system to begin working on this case.</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/cases/${caseData.id}" class="button">View Case Details</a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated notification from the Baaseteen Case Management System.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      New Case Assignment - Baaseteen CMS
      
      Dear ${user.first_name} ${user.last_name},
      
      You have been assigned to a new case:
      
      Case Number: ${caseData.case_number}
      Applicant: ${caseData.applicant_first_name} ${caseData.applicant_last_name}
      ITS Number: ${caseData.its_number}
      Case Type: ${caseData.case_type.toUpperCase()}
      Assigned by: ${assignedBy.first_name} ${assignedBy.last_name}
      
      Please log in to the system to begin working on this case.
      ${process.env.FRONTEND_URL}/cases/${caseData.id}
      
      This is an automated notification from the Baaseteen Case Management System.
    `;

    return await this.sendEmail(user.email, subject, html, text);
  }

  async sendFormCompletionNotification(user, caseData) {
    const subject = `Counseling Form Completed - ${caseData.case_number}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #008B8B; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .case-info { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #008B8B; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #008B8B; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Baaseteen Case Management System</h1>
            <h2>Counseling Form Completed</h2>
          </div>
          
          <div class="content">
            <p>Dear ${user.first_name} ${user.last_name},</p>
            
            <p>The counseling form for the following case has been completed:</p>
            
            <div class="case-info">
              <h3>Case Information</h3>
              <p><strong>Case Number:</strong> ${caseData.case_number}</p>
              <p><strong>Applicant:</strong> ${caseData.applicant_first_name} ${caseData.applicant_last_name}</p>
              <p><strong>ITS Number:</strong> ${caseData.its_number}</p>
              <p><strong>Case Type:</strong> ${caseData.case_type.toUpperCase()}</p>
            </div>
            
            <p>The case is now ready for review. Please log in to the system to proceed with the next steps.</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/cases/${caseData.id}" class="button">Review Case</a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated notification from the Baaseteen Case Management System.</p>
            <p>Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Counseling Form Completed - Baaseteen CMS
      
      Dear ${user.first_name} ${user.last_name},
      
      The counseling form for the following case has been completed:
      
      Case Number: ${caseData.case_number}
      Applicant: ${caseData.applicant_first_name} ${caseData.applicant_last_name}
      ITS Number: ${caseData.its_number}
      Case Type: ${caseData.case_type.toUpperCase()}
      
      The case is now ready for review. Please log in to the system to proceed.
      ${process.env.FRONTEND_URL}/cases/${caseData.id}
      
      This is an automated notification from the Baaseteen Case Management System.
    `;

    return await this.sendEmail(user.email, subject, html, text);
  }
}

module.exports = new EmailService();
