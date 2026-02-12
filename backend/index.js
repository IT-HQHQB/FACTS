const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { testConnection } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const caseRoutes = require('./routes/cases');
const applicantRoutes = require('./routes/applicants');
const counselingFormRoutes = require('./routes/counselingForms');
const coverLetterRoutes = require('./routes/coverLetters');
const coverLetterFormRoutes = require('./routes/coverLetterForms');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const attachmentRoutes = require('./routes/attachments');
const roleRoutes = require('./routes/roles');
const jamiatRoutes = require('./routes/jamiat');
const jamaatRoutes = require('./routes/jamaat');
const caseTypeRoutes = require('./routes/caseTypes');
const permissionRoutes = require('./routes/permissions');
const relationRoutes = require('./routes/relations');
const educationLevelRoutes = require('./routes/educationLevels');
const occupationRoutes = require('./routes/occupations');
const businessAssetsRoutes = require('./routes/businessAssets');
const executiveLevelRoutes = require('./routes/executiveLevels');
const workflowStagesRoutes = require('./routes/workflowStages');
const welfareChecklistRoutes = require('./routes/welfareChecklist');
const caseIdentificationRoutes = require('./routes/caseIdentifications');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy - required for express-rate-limit when behind a proxy
app.set('trust proxy', true);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/applicants', applicantRoutes);
app.use('/api/counseling-forms', counselingFormRoutes);
app.use('/api/cover-letters', coverLetterRoutes);
app.use('/api/cover-letter-forms', coverLetterFormRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/jamiat', jamiatRoutes);
app.use('/api/jamaat', jamaatRoutes);
app.use('/api/case-types', caseTypeRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/relations', relationRoutes);
app.use('/api/education-levels', educationLevelRoutes);
app.use('/api/occupations', occupationRoutes);
app.use('/api/business-assets', businessAssetsRoutes);
app.use('/api/executive-levels', executiveLevelRoutes);
app.use('/api/workflow-stages', workflowStagesRoutes);
app.use('/api/welfare-checklist', welfareChecklistRoutes);
app.use('/api/case-identifications', caseIdentificationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON format' });
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
