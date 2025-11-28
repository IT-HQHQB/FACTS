const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool } = require('../../config/database');

// Generate JWT token for testing
// Note: The token will be validated by auth middleware which checks the database
// So the user must exist in the database for the token to work
const generateTestToken = async (userData = {}) => {
  // If userData has an id, use it, otherwise create a default user in DB
  let user;
  
  if (userData.id) {
    // Fetch user from database
    const [users] = await pool.execute(
      'SELECT id, username, role FROM users WHERE id = ?',
      [userData.id]
    );
    
    if (users.length === 0) {
      throw new Error('User not found in database');
    }
    
    user = users[0];
  } else {
    // Create a default test user
    user = await createTestUser(userData);
  }
  
  return jwt.sign(
    { userId: user.id, username: user.username || user.email, role: user.role },
    process.env.JWT_SECRET || 'test-jwt-secret-key',
    { expiresIn: '24h' }
  );
};

// Create test user
const createTestUser = async (userData = {}) => {
  const defaultUser = {
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@test.com`,
    password: 'Test@1234',
    full_name: 'Test User',
    role: 'dcm',
    is_active: 1
  };
  
  const user = { ...defaultUser, ...userData };
  const passwordHash = await bcrypt.hash(user.password, 10);
  
  const [result] = await pool.execute(
    'INSERT INTO users (username, email, password_hash, full_name, role, is_active, executive_level) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [user.username, user.email, passwordHash, user.full_name, user.role, user.is_active, user.executive_level || null]
  );
  
  const userId = result.insertId;
  
  // Assign role to user if role exists
  if (user.role) {
    const [roles] = await pool.execute(
      'SELECT id FROM roles WHERE name = ? OR name = ? LIMIT 1',
      [user.role, user.role.toLowerCase()]
    );
    
    if (roles.length > 0) {
      // Check if assignment already exists
      const [existing] = await pool.execute(
        'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?',
        [userId, roles[0].id]
      );
      
      if (existing.length === 0) {
        await pool.execute(
          'INSERT INTO user_roles (user_id, role_id, is_active) VALUES (?, ?, ?)',
          [userId, roles[0].id, 1]
        );
      }
    }
  }
  
  return {
    ...user,
    id: userId,
    password: user.password // Return plain password for login tests
  };
};

// Create test applicant
const createTestApplicant = async (applicantData = {}) => {
  const defaultApplicant = {
    its_number: `ITS${Date.now()}`,
    full_name: 'Test Applicant',
    age: 30,
    phone: '1234567890',
    email: 'applicant@test.com',
    address: 'Test Address',
    jamiat_name: 'Test Jamiat',
    jamaat_name: 'Test Jamaat'
  };
  
  const applicant = { ...defaultApplicant, ...applicantData };
  
  const [result] = await pool.execute(
    'INSERT INTO applicants (its_number, full_name, age, phone, email, address, jamiat_name, jamaat_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [applicant.its_number, applicant.full_name, applicant.age, applicant.phone, applicant.email, applicant.address, applicant.jamiat_name, applicant.jamaat_name]
  );
  
  return {
    ...applicant,
    id: result.insertId
  };
};

// Create test case type
const createTestCaseType = async (caseTypeData = {}) => {
  const defaultCaseType = {
    name: `Test Case Type ${Date.now()}`,
    description: 'Test description',
    is_active: 1
  };
  
  const caseType = { ...defaultCaseType, ...caseTypeData };
  
  const [result] = await pool.execute(
    'INSERT INTO case_types (name, description, is_active) VALUES (?, ?, ?)',
    [caseType.name, caseType.description, caseType.is_active]
  );
  
  return {
    ...caseType,
    id: result.insertId
  };
};

// Create test case
const createTestCase = async (caseData = {}) => {
  let applicantId = caseData.applicant_id;
  let caseTypeId = caseData.case_type_id;
  let userId = caseData.user_id;
  
  // Create applicant if not provided
  if (!applicantId) {
    const applicant = await createTestApplicant();
    applicantId = applicant.id;
  }
  
  // Create case type if not provided
  if (!caseTypeId) {
    const caseType = await createTestCaseType();
    caseTypeId = caseType.id;
  }
  
  // Create user if not provided
  if (!userId) {
    const user = await createTestUser();
    userId = user.id;
  }
  
  // Get default status
  const [statusResult] = await pool.execute(
    "SELECT id FROM statuses WHERE name = 'draft' LIMIT 1"
  );
  const statusId = statusResult[0]?.id || 1;
  
  // Get first workflow stage
  const [stageResult] = await pool.execute(
    'SELECT id FROM workflow_stages WHERE is_active = TRUE ORDER BY sort_order ASC LIMIT 1'
  );
  const stageId = stageResult[0]?.id || null;
  
  const caseNumber = `TEST-${Date.now()}`;
  
  const [result] = await pool.execute(
    'INSERT INTO cases (case_number, applicant_id, case_type_id, status_id, created_by, current_workflow_stage_id, roles) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [caseNumber, applicantId, caseTypeId, statusId, userId, stageId, userId.toString()]
  );
  
  // Update case_number to sequential format
  const formattedCaseNumber = `BS-${String(result.insertId).padStart(4, '0')}`;
  await pool.execute(
    'UPDATE cases SET case_number = ? WHERE id = ?',
    [formattedCaseNumber, result.insertId]
  );
  
  return {
    id: result.insertId,
    case_number: formattedCaseNumber,
    applicant_id: applicantId,
    case_type_id: caseTypeId,
    status_id: statusId,
    created_by: userId
  };
};

// Create test executive level
const createTestExecutiveLevel = async (levelData = {}) => {
  const defaultLevel = {
    level_number: Date.now() % 1000, // Use timestamp to ensure uniqueness
    level_name: `Test Executive Level ${Date.now()}`,
    sort_order: 1,
    is_active: 1
  };
  
  const level = { ...defaultLevel, ...levelData };
  
  // Check if level_number already exists
  if (level.level_number) {
    const [existing] = await pool.execute(
      'SELECT id FROM executive_levels WHERE level_number = ?',
      [level.level_number]
    );
    
    if (existing.length > 0) {
      // Return existing level
      const [existingLevel] = await pool.execute(
        'SELECT * FROM executive_levels WHERE id = ?',
        [existing[0].id]
      );
      return existingLevel[0];
    }
  }
  
  const [result] = await pool.execute(
    'INSERT INTO executive_levels (level_number, level_name, sort_order, is_active) VALUES (?, ?, ?, ?)',
    [level.level_number, level.level_name, level.sort_order, level.is_active]
  );
  
  return {
    ...level,
    id: result.insertId
  };
};

// Create test status
const createTestStatus = async (statusData = {}) => {
  const defaultStatus = {
    name: `test_status_${Date.now()}`,
    description: 'Test status',
    is_active: 1
  };
  
  const status = { ...defaultStatus, ...statusData };
  
  const [result] = await pool.execute(
    'INSERT INTO statuses (name, description, is_active) VALUES (?, ?, ?)',
    [status.name, status.description, status.is_active]
  );
  
  return {
    ...status,
    id: result.insertId
  };
};

// Clean up test data
const cleanupTestData = async (table, ids) => {
  if (!ids || ids.length === 0) return;
  
  const placeholders = ids.map(() => '?').join(',');
  await pool.execute(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ids);
};

// Get created test data for cleanup
const getTestDataIds = () => {
  return {
    users: [],
    applicants: [],
    cases: [],
    caseTypes: [],
    executiveLevels: [],
    statuses: [],
    counselingForms: [],
    personalDetails: [],
    familyDetails: [],
    assessments: [],
    financialAssistances: [],
    economicGrowths: [],
    declarations: [],
    attachments: []
  };
};

module.exports = {
  generateTestToken,
  createTestUser,
  createTestApplicant,
  createTestCaseType,
  createTestCase,
  createTestExecutiveLevel,
  createTestStatus,
  cleanupTestData,
  getTestDataIds
};

