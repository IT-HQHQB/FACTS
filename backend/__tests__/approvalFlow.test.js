const request = require('supertest');
const express = require('express');
const cors = require('cors');
const { pool } = require('../config/database');
const casesRouter = require('../routes/cases');
const counselingFormsRouter = require('../routes/counselingForms');
const authRouter = require('../routes/auth');
const {
  generateTestToken,
  createTestUser,
  createTestApplicant,
  createTestCaseType,
  createTestCase,
  createTestExecutiveLevel,
  createTestStatus,
  cleanupTestData,
  getTestDataIds
} = require('./helpers/testHelpers');

// Create Express app for testing (matching the actual app structure)
const app = express();

// Apply same middleware as actual app
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/cases', casesRouter);
app.use('/api/counseling-forms', counselingFormsRouter);

describe('Complete Approval Flow Tests', () => {
  let testData;
  let adminToken;
  let dcmToken;
  let welfareToken;
  let executiveToken;
  let adminUser;
  let dcmUser;
  let welfareUser;
  let executiveUser;
  let testCase;
  let testApplicant;
  let testCaseType;
  let executiveLevel1;
  let executiveLevel2;
  let submittedToWelfareStatus;

  beforeAll(async () => {
    // Initialize test data tracker
    testData = getTestDataIds();
    
    try {
      // Create test users with different roles
      adminUser = await createTestUser({ role: 'admin', full_name: 'Admin User' });
      testData.users.push(adminUser.id);
      
      dcmUser = await createTestUser({ role: 'dcm', full_name: 'DCM User' });
      testData.users.push(dcmUser.id);
      
      welfareUser = await createTestUser({ role: 'welfare_reviewer', full_name: 'Welfare Reviewer' });
      testData.users.push(welfareUser.id);
      
      executiveUser = await createTestUser({ 
        role: 'Executive Management', 
        full_name: 'Executive User',
        executive_level: 1
      });
      testData.users.push(executiveUser.id);
      
      // Generate tokens for each user (async)
      adminToken = await generateTestToken({ id: adminUser.id });
      dcmToken = await generateTestToken({ id: dcmUser.id });
      welfareToken = await generateTestToken({ id: welfareUser.id });
      executiveToken = await generateTestToken({ id: executiveUser.id });
      
      // Create test case type
      testCaseType = await createTestCaseType({ name: 'Test Case Type' });
      testData.caseTypes.push(testCaseType.id);
      
      // Create test applicant
      testApplicant = await createTestApplicant();
      testData.applicants.push(testApplicant.id);
      
      // Get or create executive levels
      // First check if levels 1 and 2 exist
      const [existingLevel1] = await pool.execute(
        'SELECT * FROM executive_levels WHERE level_number = 1 AND is_active = TRUE LIMIT 1'
      );
      
      if (existingLevel1.length > 0) {
        executiveLevel1 = existingLevel1[0];
      } else {
        executiveLevel1 = await createTestExecutiveLevel({ 
          level_number: 1, 
          level_name: 'Executive Management 1',
          sort_order: 1
        });
        testData.executiveLevels.push(executiveLevel1.id);
      }
      
      const [existingLevel2] = await pool.execute(
        'SELECT * FROM executive_levels WHERE level_number = 2 AND is_active = TRUE LIMIT 1'
      );
      
      if (existingLevel2.length > 0) {
        executiveLevel2 = existingLevel2[0];
      } else {
        executiveLevel2 = await createTestExecutiveLevel({ 
          level_number: 2, 
          level_name: 'Executive Management 2',
          sort_order: 2
        });
        testData.executiveLevels.push(executiveLevel2.id);
      }
      
      // Create or get submitted_to_welfare status
      const [statusCheck] = await pool.execute(
        "SELECT id FROM statuses WHERE name = 'submitted_to_welfare' LIMIT 1"
      );
      
      if (statusCheck.length === 0) {
        submittedToWelfareStatus = await createTestStatus({ 
          name: 'submitted_to_welfare',
          description: 'Submitted to welfare'
        });
        testData.statuses.push(submittedToWelfareStatus.id);
      } else {
        submittedToWelfareStatus = { id: statusCheck[0].id, name: 'submitted_to_welfare' };
      }
      
    } catch (error) {
      console.error('Setup error:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Clean up test data in reverse order of dependencies
    try {
      // Clean up counseling form related data
      if (testData.attachments.length > 0) {
        await cleanupTestData('attachments', testData.attachments);
      }
      if (testData.declarations.length > 0) {
        await cleanupTestData('declarations', testData.declarations);
      }
      if (testData.economicGrowths.length > 0) {
        await cleanupTestData('economic_growth', testData.economicGrowths);
      }
      if (testData.financialAssistances.length > 0) {
        await cleanupTestData('financial_assistance', testData.financialAssistances);
      }
      if (testData.assessments.length > 0) {
        await cleanupTestData('assessment', testData.assessments);
      }
      if (testData.familyDetails.length > 0) {
        await cleanupTestData('family_details', testData.familyDetails);
      }
      if (testData.personalDetails.length > 0) {
        await cleanupTestData('personal_details', testData.personalDetails);
      }
      if (testData.counselingForms.length > 0) {
        await cleanupTestData('counseling_forms', testData.counselingForms);
      }
      
      // Clean up cases
      if (testData.cases.length > 0) {
        // Delete related records first
        for (const caseId of testData.cases) {
          await pool.execute('DELETE FROM status_history WHERE case_id = ?', [caseId]);
          await pool.execute('DELETE FROM case_comments WHERE case_id = ?', [caseId]);
          await pool.execute('DELETE FROM notifications WHERE case_id = ?', [caseId]);
        }
        await cleanupTestData('cases', testData.cases);
      }
      
      // Clean up other test data
      if (testData.caseTypes.length > 0) {
        await cleanupTestData('case_types', testData.caseTypes);
      }
      if (testData.applicants.length > 0) {
        await cleanupTestData('applicants', testData.applicants);
      }
      if (testData.executiveLevels.length > 0) {
        await cleanupTestData('executive_levels', testData.executiveLevels);
      }
      if (testData.statuses.length > 0) {
        await cleanupTestData('statuses', testData.statuses);
      }
      if (testData.users.length > 0) {
        await cleanupTestData('users', testData.users);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('1. Case Creation Flow', () => {
    test('should create a new case successfully', async () => {
      const response = await request(app)
        .post('/api/cases')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          applicant_id: testApplicant.id,
          case_type_id: testCaseType.id,
          roles: dcmUser.id.toString(),
          assigned_counselor_id: dcmUser.id
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('caseId');
      expect(response.body).toHaveProperty('caseNumber');
      
      testCase = {
        id: response.body.caseId,
        case_number: response.body.caseNumber
      };
      testData.cases.push(testCase.id);
    });

    test('should get the created case', async () => {
      const response = await request(app)
        .get(`/api/cases/${testCase.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.case).toHaveProperty('id', testCase.id);
      expect(response.body.case).toHaveProperty('case_number', testCase.case_number);
    });
  });

  describe('2. Counseling Form Creation and Update', () => {
    let counselingFormId;

    test('should get/create counseling form for the case', async () => {
      const response = await request(app)
        .get(`/api/counseling-forms/case/${testCase.id}`)
        .set('Authorization', `Bearer ${dcmToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('form');
      expect(response.body.form).toHaveProperty('case_id', testCase.id);
      
      counselingFormId = response.body.form.id;
      testData.counselingForms.push(counselingFormId);
      
      // Track personal details if created
      if (response.body.form.personal_details_id) {
        testData.personalDetails.push(response.body.form.personal_details_id);
      }
    });

    test('should update personal details section', async () => {
      const personalDetailsData = {
        its_number: testApplicant.its_number,
        age: '30',
        jamiat: 'Test Jamiat',
        jamaat: 'Test Jamaat',
        contact_number: '1234567890',
        email: 'test@example.com',
        residential_address: 'Test Address',
        present_occupation: 'Software Developer',
        occupation_address: 'Office Address',
        other_info: 'Additional information'
      };

      const response = await request(app)
        .put(`/api/counseling-forms/${counselingFormId}/section/personal_details`)
        .set('Authorization', `Bearer ${dcmToken}`)
        .send(personalDetailsData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Section updated successfully');
    });

    test('should update family details section', async () => {
      const familyDetailsData = {
        family_structure: 'Nuclear family',
        other_details: 'Family details',
        wellbeing: {
          housing: 'Good',
          education: 'Good',
          health: 'Good',
          deeni: 'Good',
          ziyarat_travel_recreation: 'Good'
        },
        income_expense: {
          income: {
            business_monthly: '50000',
            business_yearly: '600000',
            salary_monthly: '30000',
            salary_yearly: '360000',
            total_monthly: '80000',
            total_yearly: '960000'
          },
          expenses: {
            food_monthly: '20000',
            food_yearly: '240000',
            housing_monthly: '15000',
            housing_yearly: '180000',
            total_monthly: '50000',
            total_yearly: '600000'
          },
          surplus_monthly: '30000',
          surplus_yearly: '360000'
        },
        assets_liabilities: {
          assets: {
            residential: '500000',
            machinery_vehicle: '200000'
          },
          liabilities: {
            borrowing_qardan: '100000',
            total: '100000'
          }
        },
        family_members: [
          {
            name: 'Spouse',
            age: '28',
            relation_id: 2, // Assuming relation IDs exist
            education_id: 1,
            occupation_id: 1,
            annual_income: '300000'
          }
        ]
      };

      const response = await request(app)
        .put(`/api/counseling-forms/${counselingFormId}/section/family_details`)
        .set('Authorization', `Bearer ${dcmToken}`)
        .send(familyDetailsData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Section updated successfully');
    });

    test('should update assessment section', async () => {
      const assessmentData = {
        background: {
          education: 'Graduate',
          work_experience: '5 years',
          family_business: 'No',
          skills_knowledge: 'Technical skills',
          counselor_assessment: 'Good candidate'
        },
        proposed_business: {
          products_services: [
            {
              product_service: 'Software Development',
              unit: 'Project',
              cost: 50000,
              price: 100000
            }
          ],
          trade_mark: 'Yes',
          online_presence: 'Website',
          digital_marketing: 'Social media',
          store_location: 'Office',
          sourcing: 'Direct',
          selling: 'Online and offline',
          major_expenses: 'Infrastructure'
        },
        counselor_assessment: {
          demand_supply: 'High demand',
          growth_potential: 'High',
          competition_strategy: 'Quality service',
          support_needed: ['financial', 'marketing']
        }
      };

      const response = await request(app)
        .put(`/api/counseling-forms/${counselingFormId}/section/assessment`)
        .set('Authorization', `Bearer ${dcmToken}`)
        .send(assessmentData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Section updated successfully');
    });

    test('should update financial assistance section', async () => {
      const financialAssistanceData = {
        assistance_required: '500000',
        self_funding: '100000',
        rahen_available: '200000',
        repayment_schedule: {
          year1: '100000',
          year2: '100000',
          year3: '100000',
          year4: '100000',
          year5: '100000'
        },
        qh_fields: [
          {
            name: 'QH1',
            year1: '50000',
            year2: '50000',
            year3: '50000',
            year4: '50000',
            year5: '50000'
          }
        ],
        timeline: [
          {
            timeline: 'Month 1',
            purpose: 'Initial setup',
            amount: '200000',
            support_document: 'Quotation'
          }
        ]
      };

      const response = await request(app)
        .put(`/api/counseling-forms/${counselingFormId}/section/financial_assistance`)
        .set('Authorization', `Bearer ${dcmToken}`)
        .send(financialAssistanceData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Section updated successfully');
    });

    test('should update economic growth section', async () => {
      const economicGrowthData = {
        revenue_sales_last_year: '1000000',
        revenue_sales_year1: '1200000',
        revenue_sales_year2: '1500000',
        total_expenses_last_year: '800000',
        total_expenses_year1: '900000',
        total_expenses_year2: '1000000',
        profit_last_year: '200000',
        profit_year1: '300000',
        profit_year2: '500000',
        cash_surplus_last_year: '100000',
        cash_surplus_year1: '150000',
        cash_surplus_year2: '250000',
        projections: [
          {
            category: 'Revenue',
            present: '1000000',
            year1: '1200000',
            year2: '1500000'
          }
        ]
      };

      const response = await request(app)
        .put(`/api/counseling-forms/${counselingFormId}/section/economic_growth`)
        .set('Authorization', `Bearer ${dcmToken}`)
        .send(economicGrowthData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Section updated successfully');
    });

    test('should update declaration section', async () => {
      const declarationData = {
        applicant_confirmation: true,
        applicant_name: testApplicant.full_name,
        applicant_contact: testApplicant.phone,
        declaration_date: new Date().toISOString(),
        signature_type: 'digital',
        other_comments: 'Test declaration'
      };

      const response = await request(app)
        .put(`/api/counseling-forms/${counselingFormId}/section/declaration`)
        .set('Authorization', `Bearer ${dcmToken}`)
        .send(declarationData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Section updated successfully');
    });

    test('should update attachments section', async () => {
      const attachmentsData = {
        work_place_photo: true,
        quotation: true,
        product_brochure: true,
        income_tax_return: false,
        financial_statements: true,
        other_documents: false
      };

      const response = await request(app)
        .put(`/api/counseling-forms/${counselingFormId}/section/attachments`)
        .set('Authorization', `Bearer ${dcmToken}`)
        .send(attachmentsData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Section updated successfully');
    });

    test('should complete the counseling form', async () => {
      const response = await request(app)
        .put(`/api/counseling-forms/${counselingFormId}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('completed successfully');
    });
  });

  describe('3. Welfare Approval Flow', () => {
    test('should approve case by welfare reviewer', async () => {
      // First, ensure case is in submitted_to_welfare status
      await pool.execute(
        'UPDATE cases SET status = ? WHERE id = ?',
        ['submitted_to_welfare', testCase.id]
      );

      const response = await request(app)
        .put(`/api/cases/${testCase.id}/welfare-approve`)
        .set('Authorization', `Bearer ${welfareToken}`)
        .send({
          comments: 'Case approved by welfare department after thorough review'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('approved successfully');
      
      // Verify case status was updated
      const [caseCheck] = await pool.execute(
        'SELECT status FROM cases WHERE id = ?',
        [testCase.id]
      );
      expect(caseCheck[0].status).toMatch(/submitted_to_executive/);
    });

    test('should reject case by welfare reviewer (rework)', async () => {
      // Create another case for rejection test
      const rejectCase = await createTestCase({
        applicant_id: testApplicant.id,
        case_type_id: testCaseType.id,
        user_id: dcmUser.id
      });
      testData.cases.push(rejectCase.id);
      
      // Set status to submitted_to_welfare
      await pool.execute(
        'UPDATE cases SET status = ? WHERE id = ?',
        ['submitted_to_welfare', rejectCase.id]
      );

      const response = await request(app)
        .put(`/api/cases/${rejectCase.id}/welfare-reject`)
        .set('Authorization', `Bearer ${welfareToken}`)
        .send({
          comments: 'Case needs more information. Please provide additional documents.'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      
      // Verify case status was updated to welfare_rejected
      const [caseCheck] = await pool.execute(
        'SELECT status FROM cases WHERE id = ?',
        [rejectCase.id]
      );
      expect(caseCheck[0].status).toBe('welfare_rejected');
    });
  });

  describe('4. Executive Approval Flow', () => {
    test('should approve case by executive management level 1', async () => {
      // Ensure case is in submitted_to_executive_1 status
      await pool.execute(
        'UPDATE cases SET status = ?, current_executive_level = ? WHERE id = ?',
        [`submitted_to_executive_${executiveLevel1.level_number}`, executiveLevel1.level_number, testCase.id]
      );

      const response = await request(app)
        .put(`/api/cases/${testCase.id}/executive-approve`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({
          comments: 'Approved by Executive Management Level 1'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      
      // Verify case moved to next level or finance
      const [caseCheck] = await pool.execute(
        'SELECT status, current_executive_level FROM cases WHERE id = ?',
        [testCase.id]
      );
      
      // Should either be at next executive level or finance_disbursement
      expect(
        caseCheck[0].status === `submitted_to_executive_${executiveLevel2.level_number}` ||
        caseCheck[0].status === 'finance_disbursement'
      ).toBe(true);
    });

    test('should reject case by executive management (rework)', async () => {
      // Create another case for executive rejection test
      const execRejectCase = await createTestCase({
        applicant_id: testApplicant.id,
        case_type_id: testCaseType.id,
        user_id: dcmUser.id
      });
      testData.cases.push(execRejectCase.id);
      
      // Set status to submitted_to_executive_1
      await pool.execute(
        'UPDATE cases SET status = ?, current_executive_level = ? WHERE id = ?',
        [`submitted_to_executive_${executiveLevel1.level_number}`, executiveLevel1.level_number, execRejectCase.id]
      );

      const response = await request(app)
        .put(`/api/cases/${execRejectCase.id}/executive-rework`)
        .set('Authorization', `Bearer ${executiveToken}`)
        .send({
          comments: 'Need clarification on financial projections'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      
      // Verify case status was updated
      const [caseCheck] = await pool.execute(
        'SELECT status FROM cases WHERE id = ?',
        [execRejectCase.id]
      );
      expect(caseCheck[0].status).toBe('executive_rejected');
    });
  });

  describe('5. Comment and History Flow', () => {
    test('should add a comment to the case', async () => {
      const response = await request(app)
        .post(`/api/cases/${testCase.id}/comments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          comment: 'Test comment on the case',
          comment_type: 'general'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('comment');
      expect(response.body.comment).toHaveProperty('comment', 'Test comment on the case');
    });

    test('should get case comments', async () => {
      const response = await request(app)
        .get(`/api/cases/${testCase.id}/comments`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('comments');
      expect(Array.isArray(response.body.comments)).toBe(true);
    });

    test('should get case with status history', async () => {
      const response = await request(app)
        .get(`/api/cases/${testCase.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.case).toHaveProperty('id', testCase.id);
    });
  });

  describe('6. Error Handling and Edge Cases', () => {
    test('should not allow non-welfare user to approve welfare', async () => {
      const response = await request(app)
        .put(`/api/cases/${testCase.id}/welfare-approve`)
        .set('Authorization', `Bearer ${dcmToken}`)
        .send({
          comments: 'Should not work'
        });

      expect(response.status).toBe(403);
    });

    test('should not allow non-executive user to approve executive', async () => {
      const response = await request(app)
        .put(`/api/cases/${testCase.id}/executive-approve`)
        .set('Authorization', `Bearer ${dcmToken}`)
        .send({
          comments: 'Should not work'
        });

      expect(response.status).toBe(403);
    });

    test('should not allow completing form without all sections', async () => {
      // Create a new case and form
      const incompleteCase = await createTestCase({
        applicant_id: testApplicant.id,
        case_type_id: testCaseType.id,
        user_id: dcmUser.id
      });
      testData.cases.push(incompleteCase.id);

      const formResponse = await request(app)
        .get(`/api/counseling-forms/case/${incompleteCase.id}`)
        .set('Authorization', `Bearer ${dcmToken}`);

      const incompleteFormId = formResponse.body.form.id;
      testData.counselingForms.push(incompleteFormId);

      // Try to complete without filling all sections
      const response = await request(app)
        .put(`/api/counseling-forms/${incompleteFormId}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing sections');
    });

    test('should not allow welfare approval without required status', async () => {
      // Set case to wrong status
      await pool.execute(
        'UPDATE cases SET status = ? WHERE id = ?',
        ['draft', testCase.id]
      );

      const response = await request(app)
        .put(`/api/cases/${testCase.id}/welfare-approve`)
        .set('Authorization', `Bearer ${welfareToken}`)
        .send({
          comments: 'Should fail'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('submitted to welfare');
    });
  });

  describe('7. Data Retrieval and Validation', () => {
    test('should retrieve complete counseling form data', async () => {
      const response = await request(app)
        .get(`/api/counseling-forms/case/${testCase.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.form).toHaveProperty('personal_details');
      expect(response.body.form).toHaveProperty('family_details');
      expect(response.body.form).toHaveProperty('assessment');
      expect(response.body.form).toHaveProperty('financial_assistance');
      expect(response.body.form).toHaveProperty('economic_growth');
      expect(response.body.form).toHaveProperty('declaration');
      expect(response.body.form).toHaveProperty('attachments');
    });

    test('should validate case exists before operations', async () => {
      const fakeCaseId = 999999;
      
      const response = await request(app)
        .get(`/api/cases/${fakeCaseId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });
});

