const express = require('express');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const { authenticateToken, authorizeCaseAccess } = require('../middleware/auth');
const { hasPermission } = require('../utils/roleUtils');
const notificationService = require('../services/notificationService');

const router = express.Router();

// Generate cover letter
router.post('/generate/:caseId', authenticateToken, authorizeCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;

    // Get case and applicant details
    const [cases] = await pool.execute(`
      SELECT 
        c.*,
        a.first_name, a.last_name, a.father_name, a.mother_name,
        a.date_of_birth, a.gender, a.marital_status, a.phone, a.email,
        a.address, a.mauze, a.city, a.state, a.postal_code, a.its_number,
        dcm.first_name as dcm_first_name, dcm.last_name as dcm_last_name,
        counselor.first_name as counselor_first_name, counselor.last_name as counselor_last_name
      FROM cases c
      JOIN applicants a ON c.applicant_id = a.id
      LEFT JOIN users dcm ON c.roles = dcm.id
      LEFT JOIN users counselor ON c.assigned_counselor_id = counselor.id
      WHERE c.id = ?
    `, [caseId]);

    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = cases[0];

    // Get counseling form data
    const [forms] = await pool.execute(
      'SELECT * FROM counseling_forms WHERE case_id = ? AND is_complete = 1',
      [caseId]
    );

    if (forms.length === 0) {
      return res.status(400).json({ error: 'Counseling form must be completed before generating cover letter' });
    }

    const formData = forms[0];

    // Generate PDF cover letter
    const fileName = `cover_letter_${caseData.case_number}_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../uploads/cover_letters', fileName);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(filePath));

    // Add content to PDF
    generateCoverLetterContent(doc, caseData, formData);

    doc.end();

    // Save cover letter record to database
    const [result] = await pool.execute(`
      INSERT INTO cover_letters (case_id, file_path, generated_by)
      VALUES (?, ?, ?)
    `, [caseId, filePath, req.user.id]);

    // Update case status if not already submitted
    if (caseData.status === 'cover_letter_generated') {
      await pool.execute(
        'UPDATE cases SET status = "submitted_to_welfare" WHERE id = ?',
        [caseId]
      );

      await pool.execute(`
        INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments)
        VALUES (?, "cover_letter_generated", "submitted_to_welfare", ?, "Cover letter generated and case submitted")
      `, [caseId, req.user.id]);

      // Send status change notifications
      await notificationService.sendCaseStatusNotification(
        caseId,
        'cover_letter_generated',
        'submitted_to_welfare',
        req.user,
        'Cover letter generated and case submitted'
      );
    }

    // Send cover letter generation notification
    await notificationService.sendCoverLetterGeneratedNotification(caseId, req.user);

    res.json({
      message: 'Cover letter generated successfully',
      coverLetterId: result.insertId,
      fileName,
      filePath: `/uploads/cover_letters/${fileName}`
    });
  } catch (error) {
    console.error('Generate cover letter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get cover letters for a case
router.get('/case/:caseId', authenticateToken, authorizeCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;

    const [coverLetters] = await pool.execute(`
      SELECT 
        cl.*,
        u.full_name as generated_by_full_name
      FROM cover_letters cl
      JOIN users u ON cl.generated_by = u.id
      WHERE cl.case_id = ?
      ORDER BY cl.generated_at DESC
    `, [caseId]);

    res.json({ coverLetters });
  } catch (error) {
    console.error('Get cover letters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download cover letter
router.get('/download/:coverLetterId', authenticateToken, async (req, res) => {
  try {
    const { coverLetterId } = req.params;

    const [coverLetters] = await pool.execute(`
      SELECT cl.*, c.case_number
      FROM cover_letters cl
      JOIN cases c ON cl.case_id = c.id
      WHERE cl.id = ?
    `, [coverLetterId]);

    if (coverLetters.length === 0) {
      return res.status(404).json({ error: 'Cover letter not found' });
    }

    const coverLetter = coverLetters[0];

    // Check if user has access to this case
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user has permission to access all cover letters
    const canAccessAllCoverLetters = await hasPermission(userRole, 'cover_letters', 'read');
    if (!canAccessAllCoverLetters) {
      const [caseAccess] = await pool.execute(
        'SELECT id FROM cases WHERE id = ? AND (roles = ? OR assigned_counselor_id = ?)',
        [coverLetter.case_id, userId, userId]
      );

      if (caseAccess.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const filePath = coverLetter.file_path;
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Cover letter file not found' });
    }

    res.download(filePath, `cover_letter_${coverLetter.case_number}.pdf`);
  } catch (error) {
    console.error('Download cover letter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to generate cover letter content
function generateCoverLetterContent(doc, caseData, formData) {
  // Header
  doc.fontSize(20)
     .text('BAASEETEN CASE MANAGEMENT SYSTEM', 50, 50, { align: 'center' });
  
  doc.fontSize(16)
     .text('COVER LETTER', 50, 100, { align: 'center' });

  // Case Information
  doc.fontSize(12)
     .text(`Case Number: ${caseData.case_number}`, 50, 150)
     .text(`Case Type: ${caseData.case_type.toUpperCase()}`, 50, 170)
     .text(`Date: ${new Date().toLocaleDateString()}`, 50, 190);

  // Applicant Information
  doc.text('APPLICANT INFORMATION:', 50, 230)
     .text(`Name: ${caseData.first_name} ${caseData.last_name}`, 50, 250)
     .text(`ITS Number: ${caseData.its_number}`, 50, 270)
     .text(`Father's Name: ${caseData.father_name || 'N/A'}`, 50, 290)
     .text(`Mother's Name: ${caseData.mother_name || 'N/A'}`, 50, 310)
     .text(`Date of Birth: ${caseData.date_of_birth || 'N/A'}`, 50, 330)
     .text(`Gender: ${caseData.gender || 'N/A'}`, 50, 350)
     .text(`Marital Status: ${caseData.marital_status || 'N/A'}`, 50, 370)
     .text(`Phone: ${caseData.phone || 'N/A'}`, 50, 390)
     .text(`Email: ${caseData.email || 'N/A'}`, 50, 410)
     .text(`Address: ${caseData.address || 'N/A'}`, 50, 430)
     .text(`Mauze: ${caseData.mauze || 'N/A'}`, 50, 450)
     .text(`City: ${caseData.city || 'N/A'}`, 50, 470)
     .text(`State: ${caseData.state || 'N/A'}`, 50, 490);

  // Assigned Personnel
  doc.text('ASSIGNED PERSONNEL:', 50, 530)
     .text(`DCM: ${caseData.dcm_first_name || 'N/A'} ${caseData.dcm_last_name || 'N/A'}`, 50, 550)
     .text(`Counselor: ${caseData.counselor_first_name || 'N/A'} ${caseData.counselor_last_name || 'N/A'}`, 50, 570);

  // Form Summary (if available)
  if (formData.personal_details) {
    const personalDetails = JSON.parse(formData.personal_details);
    doc.text('PERSONAL DETAILS SUMMARY:', 50, 610);
    
    let yPosition = 630;
    Object.entries(personalDetails).forEach(([key, value]) => {
      if (value && yPosition < 750) {
        doc.text(`${key}: ${value}`, 70, yPosition);
        yPosition += 20;
      }
    });
  }

  // Footer
  doc.fontSize(10)
     .text('Generated by Baaseteen Case Management System', 50, 750, { align: 'center' })
     .text(`Generated on: ${new Date().toLocaleString()}`, 50, 770, { align: 'center' });
}

module.exports = router;
