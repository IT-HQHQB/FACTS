const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const { authenticateToken, authorizeCaseAccess } = require('../middleware/auth');
const { hasPermission } = require('../utils/roleUtils');

const router = express.Router();

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  image: 5 * 1024 * 1024, // 5MB for images
  pdf: 10 * 1024 * 1024,  // 10MB for PDFs
  document: 5 * 1024 * 1024, // 5MB for other documents
  default: 5 * 1024 * 1024   // 5MB default
};

// Helper function to get file size limit based on file type
const getFileSizeLimit = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  
  if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
    return FILE_SIZE_LIMITS.image;
  } else if (ext === '.pdf') {
    return FILE_SIZE_LIMITS.pdf;
  } else if (['.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'].includes(ext)) {
    return FILE_SIZE_LIMITS.document;
  }
  
  return FILE_SIZE_LIMITS.default;
};

// Helper function to format file size for display
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to update attachment counts in the attachments table
const updateAttachmentCount = async (caseId, stage) => {
  try {
    // Get counts for all stages
    const stages = ['work_place_photo', 'quotation', 'product_brochure', 'income_tax_return', 'financial_statements', 'other_documents'];
    const counts = {};
    
    for (const stageName of stages) {
      const [countResult] = await pool.execute(`
        SELECT COUNT(*) as count FROM case_attachments 
        WHERE case_id = ? AND stage = ?
      `, [caseId, stageName]);
      counts[stageName] = countResult[0].count;
    }
    
    // Use INSERT ... ON DUPLICATE KEY UPDATE to handle race conditions
    // This will insert if the record doesn't exist, or update if it does
    await pool.execute(`
      INSERT INTO attachments (case_id, work_place_photo, quotation, product_brochure, 
                              income_tax_return, financial_statements, other_documents)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        work_place_photo = VALUES(work_place_photo),
        quotation = VALUES(quotation),
        product_brochure = VALUES(product_brochure),
        income_tax_return = VALUES(income_tax_return),
        financial_statements = VALUES(financial_statements),
        other_documents = VALUES(other_documents),
        updated_at = CURRENT_TIMESTAMP
    `, [
      caseId,
      counts.work_place_photo,
      counts.quotation,
      counts.product_brochure,
      counts.income_tax_return,
      counts.financial_statements,
      counts.other_documents
    ]);
  } catch (error) {
    console.error('Error updating attachment count:', error);
    // Re-throw the error so the caller can handle it
    throw error;
  }
};

// Helper function to map stage names to database field names
const getStageFieldName = (stage) => {
  const stageMapping = {
    'work_place_photo': 'work_place_photo',
    'quotation': 'quotation',
    'product_brochure': 'product_brochure',
    'income_tax_return': 'income_tax_return',
    'financial_statements': 'financial_statements',
    'other_documents': 'other_documents'
  };
  return stageMapping[stage] || null;
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { caseId } = req.params;
    
    // Create base folder structure: uploads/attachments/case_id/
    const basePath = path.join(__dirname, '../uploads/attachments', caseId);
    
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
    
    // Store in base path first, we'll move to stage-specific folder later
    cb(null, basePath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf', 
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, JPG, and PNG files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
  },
  fileFilter: fileFilter
});

// Upload file for a case
router.post('/upload/:caseId', authenticateToken, authorizeCaseAccess, upload.single('file'), async (req, res) => {
  try {
    const { caseId } = req.params;
    const { stage } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, filename, path: tempFilePath, size, mimetype } = req.file;
    
    // Validate file size
    const maxSize = getFileSizeLimit(originalname);
    if (size > maxSize) {
      // Delete the temporary file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      return res.status(400).json({ 
        error: `File size exceeds maximum allowed size. Maximum size for ${path.extname(originalname).toLowerCase()} files is ${formatFileSize(maxSize)}. Your file is ${formatFileSize(size)}.` 
      });
    }

    // Create stage-specific folder
    const stageFolder = stage || 'general';
    const finalDir = path.join(__dirname, '../uploads/attachments', caseId, stageFolder);
    
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }

    // Move file to stage-specific folder
    const finalFilePath = path.join(finalDir, filename);
    fs.renameSync(tempFilePath, finalFilePath);

    // Create relative path for database storage
    const relativePath = `attachments/${caseId}/${stageFolder}/${filename}`;

    // Save file record to database
    const [result] = await pool.execute(`
      INSERT INTO case_attachments (case_id, file_name, file_path, file_type, file_size, uploaded_by, stage)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [caseId, originalname, relativePath, mimetype, size, req.user.id, stageFolder]);

    // Update attachments table to reflect file count
    await updateAttachmentCount(caseId, stageFolder);

    res.json({
      message: 'File uploaded successfully',
      attachmentId: result.insertId,
      fileName: originalname,
      fileSize: size,
      fileType: mimetype,
      filePath: relativePath
    });
  } catch (error) {
    console.error('File upload error:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    if (error.message.includes('Invalid file type')) {
      return res.status(400).json({ error: error.message });
    }
    // Check for duplicate key error
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate entry')) {
      return res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Upload multiple files for a case
router.post('/upload-multiple/:caseId', authenticateToken, authorizeCaseAccess, upload.array('files', 10), async (req, res) => {
  try {
    const { caseId } = req.params;
    const { stage } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Validate file sizes
    const invalidFiles = [];
    for (const file of req.files) {
      const maxSize = getFileSizeLimit(file.originalname);
      if (file.size > maxSize) {
        invalidFiles.push({
          filename: file.originalname,
          size: file.size,
          maxSize: maxSize,
          formattedSize: formatFileSize(file.size),
          formattedMaxSize: formatFileSize(maxSize)
        });
      }
    }

    if (invalidFiles.length > 0) {
      // Clean up uploaded files
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
      
      const errorMessage = invalidFiles.map(file => 
        `${file.filename}: ${file.formattedSize} (max: ${file.formattedMaxSize})`
      ).join(', ');
      
      return res.status(400).json({ 
        error: `File size exceeds maximum allowed size: ${errorMessage}` 
      });
    }

    // Create stage-specific folder
    const stageFolder = stage || 'general';
    const finalDir = path.join(__dirname, '../uploads/attachments', caseId, stageFolder);
    
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      const { originalname, filename, path: tempFilePath, size, mimetype } = file;

      // Move file to stage-specific folder
      const finalFilePath = path.join(finalDir, filename);
      fs.renameSync(tempFilePath, finalFilePath);

      // Create relative path for database storage
      const relativePath = `attachments/${caseId}/${stageFolder}/${filename}`;

      // Save file record to database
      const [result] = await pool.execute(`
        INSERT INTO case_attachments (case_id, file_name, file_path, file_type, file_size, uploaded_by, stage)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [caseId, originalname, relativePath, mimetype, size, req.user.id, stageFolder]);

      uploadedFiles.push({
        attachmentId: result.insertId,
        fileName: originalname,
        fileSize: size,
        fileType: mimetype,
        filePath: relativePath
      });
    }

    // Update attachments table to reflect file count
    await updateAttachmentCount(caseId, stageFolder);

    res.json({
      message: `${uploadedFiles.length} files uploaded successfully`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Multiple file upload error:', error);
    // Check for duplicate key error
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate entry')) {
      return res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Get attachments for a case
router.get('/case/:caseId', authenticateToken, authorizeCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;

    const [attachments] = await pool.execute(`
      SELECT 
        ca.*,
        COALESCE(u.full_name, 'Unknown User') as uploaded_by_name
      FROM case_attachments ca
      LEFT JOIN users u ON ca.uploaded_by = u.id
      WHERE ca.case_id = ?
      ORDER BY ca.created_at DESC
    `, [caseId]);

             // Filter out attachments where files don't exist on disk
             const validAttachments = [];
             const orphanedIds = [];

             for (const attachment of attachments) {
               const filePath = path.join(__dirname, '../uploads', attachment.file_path);
               
               if (fs.existsSync(filePath)) {
                 validAttachments.push(attachment);
               } else {
                 orphanedIds.push(attachment.id);
               }
             }

             // Clean up orphaned records in the background (don't wait for it)
             if (orphanedIds.length > 0) {
               pool.execute(`
                 DELETE FROM case_attachments
                 WHERE id IN (${orphanedIds.map(() => '?').join(',')})
               `, orphanedIds).catch(err => {
                 console.error('Error cleaning up orphaned records:', err);
               });
             }

    res.json({ 
      attachments: validAttachments,
      orphanedCount: orphanedIds.length
    });
  } catch (error) {
    console.error('Get attachments error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Download attachment
router.get('/download/:attachmentId', authenticateToken, async (req, res) => {
  try {
    const { attachmentId } = req.params;

    const [attachments] = await pool.execute(`
      SELECT 
        ca.*,
        c.case_number
      FROM case_attachments ca
      JOIN cases c ON ca.case_id = c.id
      WHERE ca.id = ?
    `, [attachmentId]);

    if (attachments.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = attachments[0];

    // Check if user has access to this case
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user has permission to access counseling forms (which includes attachments)
    const canAccessCounselingForms = await hasPermission(userRole, 'counseling_forms', 'read');
    
    if (!canAccessCounselingForms) {
      // Check if user has access to this specific case
      const [caseAccess] = await pool.execute(
        'SELECT id FROM cases WHERE id = ? AND (assigned_counselor_id = ? OR created_by = ? OR roles = ?)',
        [attachment.case_id, userId, userId, userId]
      );

      if (caseAccess.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const filePath = path.join(__dirname, '../uploads', attachment.file_path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set the correct Content-Type based on file extension
    const ext = path.extname(attachment.file_name).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.csv': 'text/csv'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    
    res.download(filePath, attachment.file_name);
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete attachment
router.delete('/:attachmentId', authenticateToken, async (req, res) => {
  try {
    const { attachmentId } = req.params;

    // Get attachment details
    const [attachments] = await pool.execute(`
      SELECT 
        ca.*,
        c.case_number
      FROM case_attachments ca
      JOIN cases c ON ca.case_id = c.id
      WHERE ca.id = ?
    `, [attachmentId]);

    if (attachments.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = attachments[0];

    // Check if user has access to this case
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user has permission to manage counseling forms (which includes attachments)
    const canManageCounselingForms = await hasPermission(userRole, 'counseling_forms', 'update');
    
    if (!canManageCounselingForms) {
      // Check if user has access to this specific case
      const [caseAccess] = await pool.execute(
        'SELECT id FROM cases WHERE id = ? AND (assigned_counselor_id = ? OR created_by = ? OR roles = ?)',
        [attachment.case_id, userId, userId, userId]
      );

      if (caseAccess.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Delete file from filesystem
    const filePath = path.join(__dirname, '../uploads', attachment.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete record from database
    await pool.execute('DELETE FROM case_attachments WHERE id = ?', [attachmentId]);

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get attachment statistics
router.get('/stats/:caseId', authenticateToken, authorizeCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;

    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_files,
        SUM(file_size) as total_size,
        COUNT(DISTINCT stage) as stages_with_files
      FROM case_attachments
      WHERE case_id = ?
    `, [caseId]);

    const [stageStats] = await pool.execute(`
      SELECT 
        stage,
        COUNT(*) as file_count,
        SUM(file_size) as total_size
      FROM case_attachments
      WHERE case_id = ?
      GROUP BY stage
    `, [caseId]);

    res.json({
      stats: stats[0],
      stageStats
    });
  } catch (error) {
    console.error('Get attachment stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
