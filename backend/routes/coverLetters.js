const express = require('express');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { pool } = require('../config/database');
const { authenticateToken, authorizeCaseAccess } = require('../middleware/auth');
const { hasPermission } = require('../utils/roleUtils');
const notificationService = require('../services/notificationService');
const buildCoverLetterPdfData = require('../utils/coverLetterPdfData');
const renderCoverLetterTemplate = require('../templates/coverLetterPdfTemplate');

const router = express.Router();

/**
 * Helper: launch Puppeteer, render HTML to PDF buffer, and always close the browser.
 * Returns a Node.js Buffer containing the PDF bytes.
 */
async function generatePdfBuffer(html) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: 'load',
      timeout: 15000
    });

    let pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '16mm',
        right: '12mm',
        bottom: '20mm',
        left: '12mm'
      },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size: 9px; color: #666; width: 100%; padding: 0 12px; display: flex; justify-content: space-between;">
          <span><span class="date"></span></span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `
    });

    // Puppeteer returns Uint8Array; convert to Buffer for consistency
    if (!(pdfBuffer instanceof Buffer)) {
      pdfBuffer = Buffer.from(pdfBuffer);
    }

    return pdfBuffer;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
  }
}

/**
 * POST /generate/:caseId
 * Generate a cover letter PDF, save to filesystem, and store a record in cover_letters table.
 */
router.post('/generate/:caseId', authenticateToken, authorizeCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;

    // Verify the case exists
    const [cases] = await pool.execute('SELECT id, case_number, status FROM cases WHERE id = ?', [caseId]);
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    const caseData = cases[0];

    // Build data and render HTML using the new template pipeline
    const data = await buildCoverLetterPdfData(pool, caseId, { userName: req.user.full_name });
    const html = renderCoverLetterTemplate(data);

    // Generate PDF buffer via Puppeteer
    const pdfBuffer = await generatePdfBuffer(html);

    // Validate PDF output
    if (!pdfBuffer || pdfBuffer.length < 10) {
      return res.status(500).json({ error: 'PDF generation produced empty or invalid output' });
    }
    const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
    if (pdfHeader !== '%PDF-') {
      return res.status(500).json({ error: 'PDF generation produced invalid output' });
    }

    // Save PDF to filesystem
    const fileName = `cover_letter_${caseData.case_number}_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../uploads/cover_letters', fileName);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, pdfBuffer);

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

/**
 * GET /preview/:caseId
 * Generate a cover letter PDF on-the-fly and stream it directly to the client.
 * Does NOT save the PDF to the filesystem or create a database record.
 */
router.get('/preview/:caseId', authenticateToken, authorizeCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;

    // Verify the case exists
    const [cases] = await pool.execute('SELECT id, case_number FROM cases WHERE id = ?', [caseId]);
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    const caseData = cases[0];

    // Build data and render HTML
    const data = await buildCoverLetterPdfData(pool, caseId, { userName: req.user.full_name });
    const html = renderCoverLetterTemplate(data);

    // Generate PDF buffer via Puppeteer
    const pdfBuffer = await generatePdfBuffer(html);

    // Validate PDF output
    if (!pdfBuffer || pdfBuffer.length < 10) {
      return res.status(500).json({ error: 'PDF generation produced empty or invalid output' });
    }
    const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
    if (pdfHeader !== '%PDF-') {
      return res.status(500).json({ error: 'PDF generation produced invalid output' });
    }

    // Stream PDF to client
    const safeCaseNumber = (caseData.case_number || caseId || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `Cover_Letter_${safeCaseNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Preview cover letter error:', error);
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

module.exports = router;
