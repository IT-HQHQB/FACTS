const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeCaseAccess } = require('../middleware/auth');
const { requireCounselingFormAccess } = require('../middleware/permissionMiddleware');
const { getCounselingFormStagePermissions, hasCounselingFormStagePermission, hasPermission } = require('../utils/permissionUtils');
const notificationService = require('../services/notificationService');

const router = express.Router();

// Helper function to update case status based on current workflow stage's associated_statuses
const updateStatusFromWorkflowStage = async (caseId, workflowStageId, caseTypeId) => {
  try {
    if (!workflowStageId) return;

    // Get the workflow stage and its associated_statuses
    const [stages] = await pool.execute(
      'SELECT associated_statuses FROM workflow_stages WHERE id = ? AND is_active = TRUE',
      [workflowStageId]
    );

    if (stages.length === 0) return;

    const stage = stages[0];
    let associatedStatuses = [];

    // Parse associated_statuses if it exists
    if (stage.associated_statuses) {
      try {
        associatedStatuses = JSON.parse(stage.associated_statuses);
      } catch (e) {
        // If parsing fails, try to use it as is if it's already an array
        associatedStatuses = Array.isArray(stage.associated_statuses) ? stage.associated_statuses : [];
      }
    }

    // If the stage has associated_statuses, update the case status to the first one
    if (associatedStatuses.length > 0) {
      const newStatus = associatedStatuses[0]; // Use first associated status
      
      // Get current case status
      const [currentCase] = await pool.execute(
        'SELECT status FROM cases WHERE id = ?',
        [caseId]
      );

      if (currentCase.length > 0 && currentCase[0].status !== newStatus) {
        // Update the case status
        await pool.execute(
          'UPDATE cases SET status = ? WHERE id = ?',
          [newStatus, caseId]
        );

        // Log status change in status_history (without user info for automatic updates)
        await pool.execute(
          `INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments) 
           VALUES (?, ?, ?, ?, ?)`,
          [caseId, currentCase[0].status, newStatus, null, 'Status automatically updated based on workflow stage progression']
        );

        return newStatus;
      }
    }
  } catch (error) {
    console.error('Error updating status from workflow stage:', error);
  }
  return null;
};

// Helper function to update case status based on completed sections
const updateCaseStatusBasedOnProgress = async (caseId) => {
  try {
    // Get the counseling form and all related data
    const [forms] = await pool.execute(
      'SELECT * FROM counseling_forms WHERE case_id = ?',
      [caseId]
    );

    if (forms.length === 0) return;

    const form = forms[0];
    let statusName = 'in_counseling'; // Default status

    // Check which sections are completed
    const hasPersonalDetails = form.personal_details_id;
    const hasFamilyDetails = form.family_details_id;
    const hasAssessment = form.assessment_id;
    const hasFinancialAssistance = form.financial_assistance_id;
    const hasEconomicGrowth = form.economic_growth_id;
    const hasDeclaration = form.declaration_id;
    const hasAttachments = form.attachments_id;

    // Check if all sections are completed
    const allSectionsComplete = hasPersonalDetails && hasFamilyDetails && hasAssessment && 
                                 hasFinancialAssistance && hasEconomicGrowth && 
                                 hasDeclaration && hasAttachments;

    // Get current case info
    const [currentCase] = await pool.execute(
      'SELECT status, case_type_id, current_workflow_stage_id FROM cases WHERE id = ?',
      [caseId]
    );

    if (currentCase.length === 0) return;

    const caseData = currentCase[0];
    const caseTypeId = caseData.case_type_id;

    // If form is marked complete but status is still in_counseling, update it
    if (form.is_complete && caseData.status === 'in_counseling') {
      // Form is complete, but status hasn't been updated - update based on workflow stage
      const [welfareStages] = await pool.execute(
        'SELECT id, associated_statuses FROM workflow_stages WHERE stage_key = ? AND is_active = TRUE AND (case_type_id = ? OR (case_type_id IS NULL AND ? IS NULL)) ORDER BY CASE WHEN case_type_id IS NULL THEN 1 ELSE 0 END LIMIT 1',
        ['welfare_review', caseTypeId, caseTypeId]
      );

      if (welfareStages.length > 0) {
        await updateStatusFromWorkflowStage(caseId, welfareStages[0].id, caseTypeId);
      }
      return; // Exit early
    }

    // Note: Status and workflow stage should only be updated when form is explicitly 
    // marked as complete via the /complete endpoint, not automatically when all sections are complete.
    // This ensures the user must click "Mark as Complete & Submit" before the case moves to welfare review.

    // Determine status based on completed sections for in-progress cases
    if (hasPersonalDetails) {
      // If at least personal details is started, ensure status is in_counseling
      if (!allSectionsComplete) {
        statusName = 'in_counseling';
      } else {
        // All sections completed - status will be updated when form is explicitly completed via /complete endpoint
        statusName = 'in_counseling';
      }
    } else {
      // If no sections started, keep as assigned
      statusName = 'assigned';
    }

    // Only update status if it has changed (to avoid unnecessary updates)
    if (caseData.status !== statusName) {
      // Update the case status directly (status is an ENUM column)
      await pool.execute(
        'UPDATE cases SET status = ? WHERE id = ?',
        [statusName, caseId]
      );

      // Update workflow stage if transitioning to in_counseling (moves to Counselor stage)
      if (statusName === 'in_counseling') {
        const [stages] = await pool.execute(
          'SELECT id, stage_name FROM workflow_stages WHERE stage_key = ? AND is_active = TRUE AND (case_type_id = ? OR (case_type_id IS NULL AND ? IS NULL)) ORDER BY CASE WHEN case_type_id IS NULL THEN 1 ELSE 0 END LIMIT 1',
          ['counselor', caseTypeId, caseTypeId]
        );
        
        if (stages.length > 0) {
          const stageId = stages[0].id;
          const stageName = stages[0].stage_name;
          
          // Get current workflow history
          const [caseHistory] = await pool.execute(
            'SELECT workflow_history, current_workflow_stage_id FROM cases WHERE id = ?',
            [caseId]
          );
          
          // Skip if already in this stage
          if (caseHistory.length > 0 && caseHistory[0].current_workflow_stage_id !== stageId) {
            let workflowHistory = [];
            if (caseHistory[0].workflow_history) {
              try {
                workflowHistory = JSON.parse(caseHistory[0].workflow_history);
              } catch (e) {
                workflowHistory = [];
              }
            }
            
            // Add new entry (no user info available for automatic updates)
            workflowHistory.push({
              stage_id: stageId,
              stage_name: stageName,
              entered_at: new Date().toISOString(),
              entered_by: null,
              entered_by_name: 'System',
              action: 'form_progress'
            });
            
            // Update case workflow stage
            await pool.execute(
              'UPDATE cases SET current_workflow_stage_id = ?, workflow_history = ? WHERE id = ?',
              [stageId, JSON.stringify(workflowHistory), caseId]
            );
          }
        }
      }
    }

  } catch (error) {
    console.error('Error updating case status:', error);
  }
};

// Get counseling form for a case
router.get('/case/:caseId', authenticateToken, authorizeCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;

    // Check if counseling form exists
    const [forms] = await pool.execute(
      'SELECT * FROM counseling_forms WHERE case_id = ?',
      [caseId]
    );

    if (forms.length === 0) {
      // Create new counseling form with child table references
      const [result] = await pool.execute(
        'INSERT INTO counseling_forms (case_id) VALUES (?)',
        [caseId]
      );

      const formId = result.insertId;

      // Get applicant data and counselor info to populate personal details and declaration
      const [caseData] = await pool.execute(`
        SELECT 
          c.*,
          c.status as case_status,
          a.its_number,
          a.full_name,
          a.age,
          a.phone,
          a.email,
          a.address,
          a.jamiat_name,
          a.jamaat_name,
          counselor.full_name as counselor_full_name,
          counselor.phone as counselor_phone,
          counselor.its_number as counselor_its_number
        FROM cases c
        JOIN applicants a ON c.applicant_id = a.id
        LEFT JOIN users counselor ON c.assigned_counselor_id = counselor.id
        WHERE c.id = ?
      `, [caseId]);

      if (caseData.length === 0) {
        return res.status(404).json({ error: 'Case not found' });
      }

      const applicant = caseData[0];

      // Create personal details record
      const [personalDetailsResult] = await pool.execute(`
        INSERT INTO personal_details (
          case_id, its_number, name, age, education, jamiat, jamaat, contact_number, 
          email, residential_address, present_occupation, occupation_address, other_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        caseId,
        applicant.its_number || '',
        applicant.full_name || '',
        applicant.age || null,
        '', // education
        applicant.jamiat_name || '',
        applicant.jamaat_name || '',
        applicant.phone || '',
        applicant.email || '',
        applicant.address || '',
        '',
        '',
        ''
      ]);

      // Update counseling form with personal details ID
      await pool.execute(
        'UPDATE counseling_forms SET personal_details_id = ? WHERE id = ?',
        [personalDetailsResult.insertId, formId]
      );

      // Return the form data in the format expected by frontend
      const personalDetailsData = {
          its_number: applicant.its_number || '',
          name: applicant.full_name || '',
          age: applicant.age ? applicant.age.toString() : '',
          jamiat: applicant.jamiat_name || '',
          jamaat: applicant.jamaat_name || '',
          contact_number: applicant.phone || '',
          email: applicant.email || '',
          residential_address: applicant.address || '',
          present_occupation: '',
          occupation_address: '',
          other_info: ''
      };

      // Get stage permissions for the current user
      const userRole = req.user.role;
      const stagePermissions = await getCounselingFormStagePermissions(userRole);

      // Get counselor info if assigned
      const counselorInfo = (caseData[0].assigned_counselor_id && applicant.counselor_full_name) ? {
        name: applicant.counselor_full_name || '',
        contact: applicant.counselor_phone || '',
        its_number: applicant.counselor_its_number || ''
      } : null;

      res.json({
        form: {
          id: formId,
          case_id: parseInt(caseId),
          personal_details: personalDetailsData, // Frontend expects this format
          applicant_info: {
            full_name: applicant.full_name || '',
            phone: applicant.phone || '',
            email: applicant.email || ''
          },
          counselor_info: counselorInfo,
        family_details: null,
        assessment: null,
        financial_assistance: null,
        economic_growth: null,
        declaration: null,
          attachments: null,
          is_complete: false,
          completed_at: null,
          case_status: caseData[0]?.case_status || null, // Include case status
          created_at: new Date(),
          updated_at: new Date()
        },
        stage_permissions: stagePermissions // Include stage permissions for frontend
      });
    } else {
      // Get existing form with all child table data
      const form = forms[0];
      
      // Get personal details
      let personalDetails = null;
      if (form.personal_details_id) {
        const [personalDetailsData] = await pool.execute(
          'SELECT * FROM personal_details WHERE id = ?',
          [form.personal_details_id]
        );
        personalDetails = personalDetailsData[0] || null;
      }

      // Get family details
      let familyDetails = null;
      if (form.family_details_id) {
        const [familyDetailsData] = await pool.execute(
          'SELECT * FROM family_details WHERE id = ?',
          [form.family_details_id]
        );
        familyDetails = familyDetailsData[0] || null;

        // Get family members if family details exist
        if (familyDetails) {
          const [familyMembers] = await pool.execute(
            'SELECT * FROM family_members WHERE family_details_id = ?',
            [form.family_details_id]
          );
          familyDetails.family_members = familyMembers;
        }
      }

      // Get assessment
      let assessment = null;
      if (form.assessment_id) {
        const [assessmentData] = await pool.execute(
          'SELECT * FROM assessment WHERE id = ?',
          [form.assessment_id]
        );
        assessment = assessmentData[0] || null;
      }

      // Get financial assistance
      let financialAssistance = null;
      if (form.financial_assistance_id) {
        const [financialData] = await pool.execute(
          'SELECT * FROM financial_assistance WHERE id = ?',
          [form.financial_assistance_id]
        );
        financialAssistance = financialData[0] || null;

        // Get QH repayment schedule if financial assistance exists
        if (financialAssistance) {
          const [qhSchedule] = await pool.execute(
            'SELECT * FROM financial_assistance_qh_repayment_schedule WHERE financial_assistance_id = ? ORDER BY qh_name',
            [form.financial_assistance_id]
          );
          financialAssistance.qh_fields = qhSchedule;
        }

        // Get timeline if financial assistance exists
        if (financialAssistance) {
          const [timeline] = await pool.execute(
            'SELECT id, financial_assistance_id, purpose, enayat, qardan, months, created_at, updated_at FROM financial_assistance_timeline WHERE financial_assistance_id = ?',
            [form.financial_assistance_id]
          );
          // Map new column names to old field names for backward compatibility
          financialAssistance.timeline = timeline.map(item => ({
            id: item.id,
            financial_assistance_id: item.financial_assistance_id,
            timeline: item.purpose, // purpose column maps to timeline field
            purpose: item.enayat || '',   // enayat column maps to purpose field
            amount: item.qardan,    // qardan column maps to amount field
            support_document: item.months, // months column maps to support_document field
            created_at: item.created_at,
            updated_at: item.updated_at
          }));
        }

        // Get action plan if financial assistance exists
        if (financialAssistance) {
          const [actionPlan] = await pool.execute(
            'SELECT * FROM financial_assistance_action_plan WHERE financial_assistance_id = ? ORDER BY timeline_period, action_number',
            [form.financial_assistance_id]
          );
          financialAssistance.action_plan = actionPlan;
        }

        // Get timeline assistance from financial_assistance_timeline_assistance table
        if (financialAssistance) {
          const [timelineAssistance] = await pool.execute(
            'SELECT id, timeline_period, action_number, purpose_cost, enayat, qardan, months FROM financial_assistance_timeline_assistance WHERE financial_assistance_id = ? ORDER BY timeline_period, action_number',
            [form.financial_assistance_id]
          );
          
          // Group timeline assistance by timeline_period to match frontend format
          const groupedTimelineAssistance = {
            immediate: [],
            after_1st_yr: [],
            after_2nd_yr: [],
            after_3rd_yr: [],
            after_4th_yr: [],
            '5th_yr': []
          };
          
          timelineAssistance.forEach(item => {
            if (item.timeline_period && groupedTimelineAssistance[item.timeline_period]) {
              groupedTimelineAssistance[item.timeline_period].push({
                id: item.id,
                purpose_cost: item.purpose_cost || '',
                enayat: item.enayat || '',
                qardan: item.qardan || '',
                months: item.months || ''
              });
            }
          });
          
          financialAssistance.timeline_assistance = groupedTimelineAssistance;
          
          // If no timeline assistance found in table, check if timeline_assistance JSON column still exists (backward compatibility)
          if (timelineAssistance.length === 0) {
            try {
              const jsonTimelineAssistance = financialAssistance.timeline_assistance;
              if (jsonTimelineAssistance && typeof jsonTimelineAssistance === 'string') {
                const parsed = JSON.parse(jsonTimelineAssistance);
                if (parsed && typeof parsed === 'object') {
                  financialAssistance.timeline_assistance = parsed;
                } else {
                  financialAssistance.timeline_assistance = groupedTimelineAssistance;
                }
              } else if (!jsonTimelineAssistance || (typeof jsonTimelineAssistance === 'object' && Object.keys(jsonTimelineAssistance).length === 0)) {
                financialAssistance.timeline_assistance = groupedTimelineAssistance;
              }
            } catch (e) {
              financialAssistance.timeline_assistance = groupedTimelineAssistance;
            }
          }
        }

        // Get mentors from financial_assistance_mentors table
        if (financialAssistance) {
          const [mentors] = await pool.execute(
            'SELECT its_number, name, contact_number, email, photo FROM financial_assistance_mentors WHERE financial_assistance_id = ? ORDER BY created_at',
            [form.financial_assistance_id]
          );
          
          // Format mentors for frontend (same structure as before)
          financialAssistance.support_mentors = mentors.map(mentor => ({
            its_number: mentor.its_number || '',
            name: mentor.name || '',
            contact_number: mentor.contact_number || '',
            email: mentor.email || '',
            photo: mentor.photo || null
          }));
          
          // If no mentors found in table, check if support_mentors JSON column still exists (backward compatibility)
          if (mentors.length === 0 && financialAssistance.support_mentors) {
            try {
              const jsonMentors = typeof financialAssistance.support_mentors === 'string' 
                ? JSON.parse(financialAssistance.support_mentors) 
                : financialAssistance.support_mentors;
              if (Array.isArray(jsonMentors)) {
                financialAssistance.support_mentors = jsonMentors;
              } else {
                financialAssistance.support_mentors = [];
              }
            } catch (e) {
              financialAssistance.support_mentors = [];
            }
          }
        }
      }

      // Get economic growth
      let economicGrowth = null;
      if (form.economic_growth_id) {
        const [economicData] = await pool.execute(
          'SELECT * FROM economic_growth WHERE id = ?',
          [form.economic_growth_id]
        );
        economicGrowth = economicData[0] || null;

        // Get projections if economic growth exists
        if (economicGrowth) {
          const [projections] = await pool.execute(
            'SELECT * FROM economic_growth_projections WHERE economic_growth_id = ?',
            [form.economic_growth_id]
          );
          economicGrowth.projections = projections;
        }
      }

      // Get declaration (use DATE_FORMAT for dates so they are returned as yyyy-mm-dd strings and avoid timezone shift)
      let declaration = null;
      if (form.declaration_id) {
        const [declarationData] = await pool.execute(
          `SELECT id, case_id, applicant_confirmation, applicant_its, applicant_name, applicant_contact,
            DATE_FORMAT(declaration_date, '%Y-%m-%d') AS declaration_date,
            signature_type, signature_file_path, signature_drawing_data, other_comments, applicant_signature,
            counselor_confirmation, counselor_its, counselor_name, counselor_contact,
            DATE_FORMAT(counselor_date, '%Y-%m-%d') AS counselor_date,
            counselor_signature_type, counselor_comments, counselor_signature, counselor_signature_file_path, counselor_signature_drawing_data,
            tr_committee_its, tr_committee_name, tr_committee_contact,
            DATE_FORMAT(tr_committee_date, '%Y-%m-%d') AS tr_committee_date,
            tr_committee_signature_type, tr_committee_signature_file_path, tr_committee_signature_drawing_data,
            tr_committee_signature, created_at, updated_at
          FROM declaration WHERE id = ?`,
          [form.declaration_id]
        );
        declaration = declarationData[0] || null;
      }

      // Get assigned counselor information from the case
      let counselorInfo = null;
      const [caseDataForCounselor] = await pool.execute(
        `SELECT c.assigned_counselor_id, u.full_name, u.phone, u.its_number
         FROM cases c
         LEFT JOIN users u ON c.assigned_counselor_id = u.id
         WHERE c.id = ?`,
        [caseId]
      );
      
      if (caseDataForCounselor.length > 0 && caseDataForCounselor[0].assigned_counselor_id) {
        counselorInfo = {
          name: caseDataForCounselor[0].full_name || '',
          contact: caseDataForCounselor[0].phone || '',
          its_number: caseDataForCounselor[0].its_number || ''
        };
        
        // Auto-populate counselor info in declaration if not already set
        if (declaration && (!declaration.counselor_name || !declaration.counselor_contact)) {
          if (!declaration.counselor_name && counselorInfo.name) {
            declaration.counselor_name = counselorInfo.name;
          }
          if (!declaration.counselor_contact && counselorInfo.contact) {
            declaration.counselor_contact = counselorInfo.contact;
          }
        }
      }

      // Get attachments
      let attachments = null;
      if (form.attachments_id) {
        const [attachmentsData] = await pool.execute(
          'SELECT * FROM attachments WHERE id = ?',
          [form.attachments_id]
        );
        attachments = attachmentsData[0] || null;
      }

      // Convert personal details to the format expected by frontend
      let personalDetailsForForm = null;
      if (personalDetails) {
        personalDetailsForForm = {
          its_number: personalDetails.its_number || '',
          name: personalDetails.name || '',
          age: personalDetails.age ? personalDetails.age.toString() : '',
          education: personalDetails.education || '',
          jamiat: personalDetails.jamiat || '',
          jamaat: personalDetails.jamaat || '',
          contact_number: personalDetails.contact_number || '',
          email: personalDetails.email || '',
          residential_address: personalDetails.residential_address || '',
          present_occupation: personalDetails.present_occupation || '',
          occupation_address: personalDetails.occupation_address || '',
          other_info: personalDetails.other_info || ''
        };
      }

      // Convert family details to the format expected by frontend
      let familyDetailsForForm = null;
      if (familyDetails) {
        familyDetailsForForm = {
          other_details: familyDetails.other_details || '',
          wellbeing: {
            food: familyDetails.wellbeing_food || '',
            housing: familyDetails.wellbeing_housing || '',
            education: familyDetails.wellbeing_education || '',
            health: familyDetails.wellbeing_health || '',
            deeni: familyDetails.wellbeing_deeni || ''
          },
          income_expense: {
            income: {
              business_monthly: familyDetails.income_business_monthly || '',
              business_yearly: familyDetails.income_business_yearly || '',
              salary_monthly: familyDetails.income_salary_monthly || '',
              salary_yearly: familyDetails.income_salary_yearly || '',
              home_industry_monthly: familyDetails.income_home_industry_monthly || '',
              home_industry_yearly: familyDetails.income_home_industry_yearly || '',
              others_monthly: familyDetails.income_others_monthly || '',
              others_yearly: familyDetails.income_others_yearly || '',
              total_monthly: familyDetails.income_total_monthly || '',
              total_yearly: familyDetails.income_total_yearly || ''
            },
            expenses: {
              food_monthly: familyDetails.expense_food_monthly || '',
              food_yearly: familyDetails.expense_food_yearly || '',
              housing_monthly: familyDetails.expense_housing_monthly || '',
              housing_yearly: familyDetails.expense_housing_yearly || '',
              health_monthly: familyDetails.expense_health_monthly || '',
              health_yearly: familyDetails.expense_health_yearly || '',
              transport_monthly: familyDetails.expense_transport_monthly || '',
              transport_yearly: familyDetails.expense_transport_yearly || '',
              education_monthly: familyDetails.expense_education_monthly || '',
              education_yearly: familyDetails.expense_education_yearly || '',
              deeni_monthly: familyDetails.expense_deeni_monthly || '',
              deeni_yearly: familyDetails.expense_deeni_yearly || '',
              essentials_monthly: familyDetails.expense_essentials_monthly || '',
              essentials_yearly: familyDetails.expense_essentials_yearly || '',
              non_essentials_monthly: familyDetails.expense_non_essentials_monthly || '',
              non_essentials_yearly: familyDetails.expense_non_essentials_yearly || '',
              others_monthly: familyDetails.expense_others_monthly || '',
              others_yearly: familyDetails.expense_others_yearly || '',
              total_monthly: familyDetails.expense_total_monthly || '',
              total_yearly: familyDetails.expense_total_yearly || ''
            },
            surplus_monthly: familyDetails.surplus_monthly || '',
            surplus_yearly: familyDetails.surplus_yearly || '',
            deficit_monthly: familyDetails.deficit_monthly || '',
            deficit_yearly: familyDetails.deficit_yearly || '',
            scholarship_monthly: familyDetails.scholarship_monthly || '',
            scholarship_yearly: familyDetails.scholarship_yearly || '',
            borrowing_monthly: familyDetails.borrowing_monthly || '',
            borrowing_yearly: familyDetails.borrowing_yearly || ''
          },
          assets_liabilities: {
            assets: {
              residential: familyDetails.assets_residential || '',
              shop_godown_land: familyDetails.assets_shop_godown_land || '',
              machinery_vehicle: familyDetails.assets_machinery_vehicle || '',
              stock_raw_material: familyDetails.assets_stock_raw_material || '',
              goods_sold_credit: familyDetails.assets_goods_sold_credit || '',
              others: familyDetails.assets_others || ''
            },
            liabilities: {
              borrowing_qardan: familyDetails.liabilities_borrowing_qardan || '',
              goods_credit: familyDetails.liabilities_goods_credit || '',
              others: familyDetails.liabilities_others || '',
              total: familyDetails.liabilities_total || ''
            }
          },
          family_members: familyDetails.family_members || []
        };
      }

      // Convert assessment to the format expected by frontend
      let assessmentForForm = null;
      if (assessment) {
        assessmentForForm = {
          background: {
            education: assessment.background_education || '',
            work_experience: assessment.background_work_experience || '',
            family_business: assessment.background_family_business || '',
            skills_knowledge: assessment.background_skills_knowledge || '',
            counselor_assessment: assessment.background_counselor_assessment || ''
          },
          proposed_business: {
            present_business_condition: assessment.proposed_present_business_condition || '',
            trade_mark: assessment.trade_mark || '',
            online_presence: assessment.online_presence || '',
            digital_marketing: assessment.digital_marketing || '',
            store_location: assessment.store_location || '',
            sourcing: assessment.proposed_sourcing || '',
            selling: assessment.proposed_selling || '',
            major_expenses: assessment.proposed_major_expenses || '',
            goods_purchase: assessment.proposed_goods_purchase || '',
            revenue: assessment.proposed_revenue || '',
            profit_margin: assessment.proposed_profit_margin || ''
          },
          counselor_assessment: {
            demand_supply: assessment.counselor_demand_supply || '',
            growth_potential: assessment.counselor_growth_potential || '',
            competition_strategy: assessment.counselor_competition_strategy || '',
            support_needed: assessment.counselor_support_needed ? 
              (typeof assessment.counselor_support_needed === 'string' ? 
                JSON.parse(assessment.counselor_support_needed) : 
                assessment.counselor_support_needed) : []
          }
        };
      }

      // Get applicant information and case status for existing forms
      const [caseData] = await pool.execute(`
        SELECT 
          a.full_name,
          a.phone,
          a.email,
          c.status as case_status
        FROM cases c
        JOIN applicants a ON c.applicant_id = a.id
        WHERE c.id = ?
      `, [caseId]);
      
      const applicant = caseData[0] || {};

      // Get stage permissions for the current user
      const userRole = req.user.role;
      const stagePermissions = await getCounselingFormStagePermissions(userRole);

      res.json({
        form: {
          id: form.id,
          case_id: form.case_id,
          personal_details_id: form.personal_details_id,
          family_details_id: form.family_details_id,
          assessment_id: form.assessment_id,
          financial_assistance_id: form.financial_assistance_id,
          economic_growth_id: form.economic_growth_id,
          declaration_id: form.declaration_id,
          attachments_id: form.attachments_id,
          personal_details: personalDetailsForForm, // Frontend expects this format
          applicant_info: {
            full_name: applicant.full_name || '',
            phone: applicant.phone || '',
            email: applicant.email || ''
          },
          counselor_info: counselorInfo ? {
            name: counselorInfo.name || '',
            contact: counselorInfo.contact || '',
            its_number: counselorInfo.its_number || ''
          } : null,
          family_details: familyDetailsForForm, // Frontend expects this format
          assessment: assessmentForForm, // Frontend expects this format
          financial_assistance: financialAssistance,
          economic_growth: economicGrowth,
          declaration: declaration,
          attachments: attachments,
          is_complete: form.is_complete,
          completed_at: form.completed_at,
          case_status: applicant.case_status || null, // Include case status
          created_at: form.created_at,
          updated_at: form.updated_at
        },
        stage_permissions: stagePermissions // Include stage permissions for frontend
      });
    }
  } catch (error) {
    console.error('Get counseling form error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a specific section of the counseling form
router.put('/:formId/section/:section', authenticateToken, async (req, res) => {
  try {
    const { formId, section } = req.params;
    const data = req.body;
    const userRole = req.user.role;

    // Map section names to stage keys
    const sectionToStageKey = {
      'personal_details': 'personal',
      'family_details': 'family',
      'assessment': 'assessment',
      'financial_assistance': 'financial',
      'economic_growth': 'growth',
      'declaration': 'declaration',
      'attachments': 'attachments'
    };

    const stageKey = sectionToStageKey[section];
    
    // Check if user has update permission for this stage
    if (stageKey) {
      const canUpdate = await hasCounselingFormStagePermission(userRole, stageKey, 'update');
      if (!canUpdate) {
        return res.status(403).json({ 
          error: 'You do not have permission' 
        });
      }
    }

    // Get the counseling form and case status
    const [forms] = await pool.execute(
      `SELECT cf.*, c.status as case_status 
       FROM counseling_forms cf 
       JOIN cases c ON cf.case_id = c.id 
       WHERE cf.id = ?`,
      [formId]
    );

    if (forms.length === 0) {
      return res.status(404).json({ error: 'Counseling form not found' });
    }

    const form = forms[0];

    // Check if form is complete and case is not rejected - if so, prevent edits
    // Forms can only be edited after completion if they were rejected (welfare_rejected status)
    if (form.is_complete && form.case_status !== 'welfare_rejected') {
      return res.status(403).json({ 
        error: 'This form has been submitted and cannot be edited. It can only be edited if it is rejected for rework.' 
      });
    }

    switch (section) {
      case 'personal_details':
        // Fetch name from applicants table using its_number
        let applicantName = '';
        if (data.its_number) {
          const [applicantData] = await pool.execute(
            'SELECT full_name FROM applicants WHERE its_number = ? LIMIT 1',
            [data.its_number]
          );
          if (applicantData.length > 0 && applicantData[0].full_name) {
            applicantName = applicantData[0].full_name;
          }
        }
        
        if (form.personal_details_id) {
          // Update existing personal details
          await pool.execute(`
            UPDATE personal_details SET
              its_number = ?, name = ?, age = ?, education = ?, jamiat = ?, jamaat = ?, contact_number = ?,
              email = ?, residential_address = ?, present_occupation = ?, 
              occupation_address = ?, other_info = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [
            data.its_number, applicantName, data.age, data.education || '', data.jamiat, data.jamaat, data.contact_number,
            data.email, data.residential_address, data.present_occupation,
            data.occupation_address, data.other_info, form.personal_details_id
          ]);
        } else {
          // Create new personal details
          const [result] = await pool.execute(`
            INSERT INTO personal_details (
              case_id, its_number, name, age, education, jamiat, jamaat, contact_number,
              email, residential_address, present_occupation, occupation_address, other_info
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            form.case_id, data.its_number, applicantName, data.age, data.education || '', data.jamiat, data.jamaat, data.contact_number,
            data.email, data.residential_address, data.present_occupation,
            data.occupation_address, data.other_info
          ]);

          // Update counseling form with personal details ID
          await pool.execute(
            'UPDATE counseling_forms SET personal_details_id = ? WHERE id = ?',
            [result.insertId, formId]
          );
        }
        break;

      case 'family_details':
        if (form.family_details_id) {
          // Update existing family details
          // Helper function to convert empty strings to null for numeric fields
          const toNumeric = (val) => {
            if (val === '' || val === null || val === undefined) return null;
            if (typeof val === 'string' && val.trim() === '') return null;
            return val;
          };
          const updateValues = [
            data.other_details || null, 
            data.wellbeing?.food || null, 
            data.wellbeing?.housing || null, 
            data.wellbeing?.education || null,
            data.wellbeing?.health || null, 
            data.wellbeing?.deeni || null,
            toNumeric(data.income_expense?.income?.business_monthly), 
            toNumeric(data.income_expense?.income?.business_yearly),
            toNumeric(data.income_expense?.income?.salary_monthly), 
            toNumeric(data.income_expense?.income?.salary_yearly),
            toNumeric(data.income_expense?.income?.home_industry_monthly), 
            toNumeric(data.income_expense?.income?.home_industry_yearly),
            toNumeric(data.income_expense?.income?.others_monthly), 
            toNumeric(data.income_expense?.income?.others_yearly),
            toNumeric(data.income_expense?.income?.total_monthly), 
            toNumeric(data.income_expense?.income?.total_yearly),
            toNumeric(data.income_expense?.expenses?.food_monthly), 
            toNumeric(data.income_expense?.expenses?.food_yearly),
            toNumeric(data.income_expense?.expenses?.housing_monthly), 
            toNumeric(data.income_expense?.expenses?.housing_yearly),
            toNumeric(data.income_expense?.expenses?.health_monthly), 
            toNumeric(data.income_expense?.expenses?.health_yearly),
            toNumeric(data.income_expense?.expenses?.transport_monthly), 
            toNumeric(data.income_expense?.expenses?.transport_yearly),
            toNumeric(data.income_expense?.expenses?.education_monthly), 
            toNumeric(data.income_expense?.expenses?.education_yearly),
            toNumeric(data.income_expense?.expenses?.deeni_monthly), 
            toNumeric(data.income_expense?.expenses?.deeni_yearly),
            toNumeric(data.income_expense?.expenses?.essentials_monthly), 
            toNumeric(data.income_expense?.expenses?.essentials_yearly),
            toNumeric(data.income_expense?.expenses?.non_essentials_monthly), 
            toNumeric(data.income_expense?.expenses?.non_essentials_yearly),
            toNumeric(data.income_expense?.expenses?.others_monthly), 
            toNumeric(data.income_expense?.expenses?.others_yearly),
            toNumeric(data.income_expense?.expenses?.total_monthly), 
            toNumeric(data.income_expense?.expenses?.total_yearly),
            toNumeric(data.income_expense?.surplus_monthly), 
            toNumeric(data.income_expense?.surplus_yearly),
            toNumeric(data.income_expense?.deficit_monthly), 
            toNumeric(data.income_expense?.deficit_yearly),
            toNumeric(data.income_expense?.scholarship_monthly), 
            toNumeric(data.income_expense?.scholarship_yearly),
            toNumeric(data.income_expense?.borrowing_monthly), 
            toNumeric(data.income_expense?.borrowing_yearly),
            data.assets_liabilities?.assets?.residential || null, 
            data.assets_liabilities?.assets?.shop_godown_land || null,
            data.assets_liabilities?.assets?.machinery_vehicle || null, 
            data.assets_liabilities?.assets?.stock_raw_material || null,
            data.assets_liabilities?.assets?.goods_sold_credit || null, 
            data.assets_liabilities?.assets?.others || null,
            toNumeric(data.assets_liabilities?.liabilities?.borrowing_qardan), 
            toNumeric(data.assets_liabilities?.liabilities?.goods_credit),
            toNumeric(data.assets_liabilities?.liabilities?.others), 
            toNumeric(data.assets_liabilities?.liabilities?.total),
            form.family_details_id
          ];
          await pool.execute(`
            UPDATE family_details SET
              other_details = ?, wellbeing_food = ?, wellbeing_housing = ?, wellbeing_education = ?,
              wellbeing_health = ?, wellbeing_deeni = ?,
              income_business_monthly = ?, income_business_yearly = ?, income_salary_monthly = ?,
              income_salary_yearly = ?, income_home_industry_monthly = ?, income_home_industry_yearly = ?,
              income_others_monthly = ?, income_others_yearly = ?, income_total_monthly = ?,
              income_total_yearly = ?, expense_food_monthly = ?, expense_food_yearly = ?,
              expense_housing_monthly = ?, expense_housing_yearly = ?, expense_health_monthly = ?,
              expense_health_yearly = ?, expense_transport_monthly = ?, expense_transport_yearly = ?,
              expense_education_monthly = ?, expense_education_yearly = ?, expense_deeni_monthly = ?,
              expense_deeni_yearly = ?, expense_essentials_monthly = ?, expense_essentials_yearly = ?,
              expense_non_essentials_monthly = ?, expense_non_essentials_yearly = ?, expense_others_monthly = ?,
              expense_others_yearly = ?, expense_total_monthly = ?, expense_total_yearly = ?,
              surplus_monthly = ?, surplus_yearly = ?, deficit_monthly = ?, deficit_yearly = ?,
              scholarship_monthly = ?, scholarship_yearly = ?, borrowing_monthly = ?, borrowing_yearly = ?,
              assets_residential = ?, assets_shop_godown_land = ?, assets_machinery_vehicle = ?,
              assets_stock_raw_material = ?, assets_goods_sold_credit = ?, assets_others = ?,
              liabilities_borrowing_qardan = ?, liabilities_goods_credit = ?, liabilities_others = ?,
              liabilities_total = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, updateValues);

          // Handle family members
          if (data.family_members && Array.isArray(data.family_members)) {
            // Delete existing family members
            await pool.execute(
              'DELETE FROM family_members WHERE family_details_id = ?',
              [form.family_details_id]
            );

            // Insert new family members
            for (const member of data.family_members) {
              if (member.name || member.age || member.relation_id) {
                await pool.execute(`
                  INSERT INTO family_members (
                    family_details_id, name, age, relation_id, education_id, occupation_id, annual_income
                  ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                  form.family_details_id, member.name, member.age, member.relation_id,
                  member.education_id, member.occupation_id, member.annual_income
                ]);
              }
            }
          }
        } else {
          // Create new family details
          // Helper function to convert empty strings to null for numeric fields
          const toNumeric = (val) => {
            if (val === '' || val === null || val === undefined) return null;
            if (typeof val === 'string' && val.trim() === '') return null;
            return val;
          };
          const insertValues = [
            form.case_id, 
            data.other_details || null, 
            data.wellbeing?.food || null, 
            data.wellbeing?.housing || null, 
            data.wellbeing?.education || null,
            data.wellbeing?.health || null, 
            data.wellbeing?.deeni || null,
            toNumeric(data.income_expense?.income?.business_monthly), 
            toNumeric(data.income_expense?.income?.business_yearly),
            toNumeric(data.income_expense?.income?.salary_monthly), 
            toNumeric(data.income_expense?.income?.salary_yearly),
            toNumeric(data.income_expense?.income?.home_industry_monthly), 
            toNumeric(data.income_expense?.income?.home_industry_yearly),
            toNumeric(data.income_expense?.income?.others_monthly), 
            toNumeric(data.income_expense?.income?.others_yearly),
            toNumeric(data.income_expense?.income?.total_monthly), 
            toNumeric(data.income_expense?.income?.total_yearly),
            toNumeric(data.income_expense?.expenses?.food_monthly), 
            toNumeric(data.income_expense?.expenses?.food_yearly),
            toNumeric(data.income_expense?.expenses?.housing_monthly), 
            toNumeric(data.income_expense?.expenses?.housing_yearly),
            toNumeric(data.income_expense?.expenses?.health_monthly), 
            toNumeric(data.income_expense?.expenses?.health_yearly),
            toNumeric(data.income_expense?.expenses?.transport_monthly), 
            toNumeric(data.income_expense?.expenses?.transport_yearly),
            toNumeric(data.income_expense?.expenses?.education_monthly), 
            toNumeric(data.income_expense?.expenses?.education_yearly),
            toNumeric(data.income_expense?.expenses?.deeni_monthly), 
            toNumeric(data.income_expense?.expenses?.deeni_yearly),
            toNumeric(data.income_expense?.expenses?.essentials_monthly), 
            toNumeric(data.income_expense?.expenses?.essentials_yearly),
            toNumeric(data.income_expense?.expenses?.non_essentials_monthly), 
            toNumeric(data.income_expense?.expenses?.non_essentials_yearly),
            toNumeric(data.income_expense?.expenses?.others_monthly), 
            toNumeric(data.income_expense?.expenses?.others_yearly),
            toNumeric(data.income_expense?.expenses?.total_monthly), 
            toNumeric(data.income_expense?.expenses?.total_yearly),
            toNumeric(data.income_expense?.surplus_monthly), 
            toNumeric(data.income_expense?.surplus_yearly),
            toNumeric(data.income_expense?.deficit_monthly), 
            toNumeric(data.income_expense?.deficit_yearly),
            toNumeric(data.income_expense?.scholarship_monthly), 
            toNumeric(data.income_expense?.scholarship_yearly),
            toNumeric(data.income_expense?.borrowing_monthly), 
            toNumeric(data.income_expense?.borrowing_yearly),
            data.assets_liabilities?.assets?.residential || null, 
            data.assets_liabilities?.assets?.shop_godown_land || null,
            data.assets_liabilities?.assets?.machinery_vehicle || null, 
            data.assets_liabilities?.assets?.stock_raw_material || null,
            data.assets_liabilities?.assets?.goods_sold_credit || null, 
            data.assets_liabilities?.assets?.others || null,
            toNumeric(data.assets_liabilities?.liabilities?.borrowing_qardan), 
            toNumeric(data.assets_liabilities?.liabilities?.goods_credit),
            toNumeric(data.assets_liabilities?.liabilities?.others), 
            toNumeric(data.assets_liabilities?.liabilities?.total)
          ];
          const [result] = await pool.execute(`
            INSERT INTO family_details (
              case_id, other_details, wellbeing_food, wellbeing_housing, wellbeing_education,
              wellbeing_health, wellbeing_deeni,
              income_business_monthly, income_business_yearly, income_salary_monthly,
              income_salary_yearly, income_home_industry_monthly, income_home_industry_yearly,
              income_others_monthly, income_others_yearly, income_total_monthly,
              income_total_yearly, expense_food_monthly, expense_food_yearly,
              expense_housing_monthly, expense_housing_yearly, expense_health_monthly,
              expense_health_yearly, expense_transport_monthly, expense_transport_yearly,
              expense_education_monthly, expense_education_yearly, expense_deeni_monthly,
              expense_deeni_yearly, expense_essentials_monthly, expense_essentials_yearly,
              expense_non_essentials_monthly, expense_non_essentials_yearly, expense_others_monthly,
              expense_others_yearly, expense_total_monthly, expense_total_yearly,
              surplus_monthly, surplus_yearly, deficit_monthly, deficit_yearly,
              scholarship_monthly, scholarship_yearly, borrowing_monthly, borrowing_yearly,
              assets_residential, assets_shop_godown_land, assets_machinery_vehicle,
              assets_stock_raw_material, assets_goods_sold_credit, assets_others,
              liabilities_borrowing_qardan, liabilities_goods_credit, liabilities_others,
              liabilities_total
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, insertValues);

          // Update counseling form with family details ID
          await pool.execute(
            'UPDATE counseling_forms SET family_details_id = ? WHERE id = ?',
            [result.insertId, formId]
          );

          // Handle family members
          if (data.family_members && Array.isArray(data.family_members)) {
            for (const member of data.family_members) {
              if (member.name || member.age || member.relation_id) {
                await pool.execute(`
                  INSERT INTO family_members (
                    family_details_id, name, age, relation_id, education_id, occupation_id, annual_income
                  ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                  result.insertId, member.name, member.age, member.relation_id,
                  member.education_id, member.occupation_id, member.annual_income
                ]);
              }
            }
          }
        }
        break;

      case 'assessment':
        let assessmentId = form.assessment_id;
        
        if (assessmentId) {
          // Update existing assessment
          await pool.execute(`
            UPDATE assessment SET
              background_education = ?, background_work_experience = ?, background_family_business = ?,
              background_skills_knowledge = ?, background_counselor_assessment = ?,
              trade_mark = ?, online_presence = ?, digital_marketing = ?, store_location = ?,
              proposed_present_business_condition = ?, proposed_sourcing = ?, proposed_selling = ?, proposed_major_expenses = ?,
              proposed_goods_purchase = ?, proposed_revenue = ?, proposed_profit_margin = ?,
              counselor_demand_supply = ?, counselor_growth_potential = ?,
              counselor_competition_strategy = ?, counselor_support_needed = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [
            data.background?.education, data.background?.work_experience, data.background?.family_business,
            data.background?.skills_knowledge, data.background?.counselor_assessment,
            data.proposed_business?.trade_mark, data.proposed_business?.online_presence, 
            data.proposed_business?.digital_marketing, data.proposed_business?.store_location,
            data.proposed_business?.present_business_condition, data.proposed_business?.sourcing, data.proposed_business?.selling, data.proposed_business?.major_expenses,
            data.proposed_business?.goods_purchase, data.proposed_business?.revenue, data.proposed_business?.profit_margin,
            data.counselor_assessment?.demand_supply, data.counselor_assessment?.growth_potential,
            data.counselor_assessment?.competition_strategy, JSON.stringify(data.counselor_assessment?.support_needed || []),
            assessmentId
          ]);

        } else {
          // Create new assessment
          const [result] = await pool.execute(`
            INSERT INTO assessment (
              case_id, background_education, background_work_experience, background_family_business,
              background_skills_knowledge, background_counselor_assessment,
              trade_mark, online_presence, digital_marketing, store_location,
              proposed_present_business_condition, proposed_sourcing, proposed_selling, proposed_major_expenses,
              proposed_goods_purchase, proposed_revenue, proposed_profit_margin,
              counselor_demand_supply, counselor_growth_potential,
              counselor_competition_strategy, counselor_support_needed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            form.case_id, data.background?.education, data.background?.work_experience, data.background?.family_business,
            data.background?.skills_knowledge, data.background?.counselor_assessment,
            data.proposed_business?.trade_mark, data.proposed_business?.online_presence, 
            data.proposed_business?.digital_marketing, data.proposed_business?.store_location,
            data.proposed_business?.present_business_condition, data.proposed_business?.sourcing, data.proposed_business?.selling, data.proposed_business?.major_expenses,
            data.proposed_business?.goods_purchase, data.proposed_business?.revenue, data.proposed_business?.profit_margin,
            data.counselor_assessment?.demand_supply, data.counselor_assessment?.growth_potential,
            data.counselor_assessment?.competition_strategy, JSON.stringify(data.counselor_assessment?.support_needed || [])
          ]);

          assessmentId = result.insertId;

          // Update counseling form with assessment ID
          await pool.execute(
            'UPDATE counseling_forms SET assessment_id = ? WHERE id = ?',
            [assessmentId, formId]
          );
        }

        break;

      case 'financial_assistance':
        if (form.financial_assistance_id) {
          // Update existing financial assistance
          // Convert undefined values to null for database
          const assistance_required = data.assistance_required === undefined || data.assistance_required === '' ? null : data.assistance_required;
          const self_funding = data.self_funding === undefined || data.self_funding === '' ? null : data.self_funding;
          const rahen_available = data.rahen_available === undefined || data.rahen_available === '' ? null : data.rahen_available;
          const repayment_year1 = data.repayment_schedule?.year1 === undefined || data.repayment_schedule?.year1 === '' ? null : data.repayment_schedule?.year1;
          const repayment_year2 = data.repayment_schedule?.year2 === undefined || data.repayment_schedule?.year2 === '' ? null : data.repayment_schedule?.year2;
          const repayment_year3 = data.repayment_schedule?.year3 === undefined || data.repayment_schedule?.year3 === '' ? null : data.repayment_schedule?.year3;
          const repayment_year4 = data.repayment_schedule?.year4 === undefined || data.repayment_schedule?.year4 === '' ? null : data.repayment_schedule?.year4;
          const repayment_year5 = data.repayment_schedule?.year5 === undefined || data.repayment_schedule?.year5 === '' ? null : data.repayment_schedule?.year5;
          
          await pool.execute(`
            UPDATE financial_assistance SET
              assistance_required = ?, self_funding = ?, rahen_available = ?,
              repayment_year1 = ?, repayment_year2 = ?, repayment_year3 = ?,
              repayment_year4 = ?, repayment_year5 = ?, support_needed = ?,
              support_industry_knowledge_desc = ?, support_sourcing_desc = ?,
              support_sales_market_desc = ?, support_internship_desc = ?,
              support_mentoring_handholding_desc = ?, support_bookkeeping_desc = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [
            assistance_required, self_funding, rahen_available,
            repayment_year1, repayment_year2, repayment_year3, repayment_year4, repayment_year5,
            JSON.stringify(data.support_needed || []),
            data.support_industry_knowledge_desc || null,
            data.support_sourcing_desc || null,
            data.support_sales_market_desc || null,
            data.support_internship_desc || null,
            data.support_mentoring_handholding_desc || null,
            data.support_bookkeeping_desc || null,
            form.financial_assistance_id
          ]);

          // Handle mentors - save to financial_assistance_mentors table
          if (data.support_mentors && Array.isArray(data.support_mentors)) {
            // Delete existing mentors for this financial_assistance
            await pool.execute(
              'DELETE FROM financial_assistance_mentors WHERE financial_assistance_id = ?',
              [form.financial_assistance_id]
            );

            // Insert new mentors
            for (const mentor of data.support_mentors) {
              if (mentor.its_number) {
                await pool.execute(`
                  INSERT INTO financial_assistance_mentors 
                  (financial_assistance_id, its_number, name, contact_number, email, photo)
                  VALUES (?, ?, ?, ?, ?, ?)
                `, [
                  form.financial_assistance_id,
                  mentor.its_number || '',
                  mentor.name || null,
                  mentor.contact_number || null,
                  mentor.email || null,
                  mentor.photo || null
                ]);
              }
            }
          }

          // Handle QH fields
          if (data.qh_fields && Array.isArray(data.qh_fields)) {
            // Delete existing QH records
            await pool.execute(
              'DELETE FROM financial_assistance_qh_repayment_schedule WHERE financial_assistance_id = ?',
              [form.financial_assistance_id]
            );

            // Insert new QH records
            for (const qhField of data.qh_fields) {
              if (qhField.name) {
                // Convert undefined values to null for database
                const year1 = qhField.year1 === undefined || qhField.year1 === '' ? null : qhField.year1;
                const year2 = qhField.year2 === undefined || qhField.year2 === '' ? null : qhField.year2;
                const year3 = qhField.year3 === undefined || qhField.year3 === '' ? null : qhField.year3;
                const year4 = qhField.year4 === undefined || qhField.year4 === '' ? null : qhField.year4;
                const year5 = qhField.year5 === undefined || qhField.year5 === '' ? null : qhField.year5;
                
                await pool.execute(`
                  INSERT INTO financial_assistance_qh_repayment_schedule (
                    financial_assistance_id, qh_name, year1, year2, year3, year4, year5
                  ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                  form.financial_assistance_id, qhField.name, year1, year2, year3, year4, year5
                ]);
              }
            }
          }

          // Handle timeline
          if (data.timeline && Array.isArray(data.timeline)) {
            // Delete existing timeline
            await pool.execute(
              'DELETE FROM financial_assistance_timeline WHERE financial_assistance_id = ?',
              [form.financial_assistance_id]
            );

            // Insert new timeline
            for (const item of data.timeline) {
              if (item.timeline || item.purpose || item.amount) {
                // Convert undefined values to null for database
                // Map old field names to new column names:
                // item.timeline → purpose column
                // item.purpose → enayat column
                // item.amount → qardan column
                // item.support_document → months column
                const purpose = item.timeline === undefined || item.timeline === '' ? null : item.timeline;
                const enayat = item.purpose === undefined || item.purpose === '' ? null : (item.purpose ? parseFloat(item.purpose) : null);
                const qardan = item.amount === undefined || item.amount === '' ? null : (item.amount ? parseFloat(item.amount) : null);
                const months = item.support_document === undefined || item.support_document === '' ? null : (item.support_document ? parseInt(item.support_document) : null);
                
                await pool.execute(`
                  INSERT INTO financial_assistance_timeline (
                    financial_assistance_id, purpose, enayat, qardan, months
                  ) VALUES (?, ?, ?, ?, ?)
                `, [
                  form.financial_assistance_id, purpose, enayat, qardan, months
                ]);
              }
            }
          }

          // Handle action plan
          if (data.action_plan && typeof data.action_plan === 'object') {
            // Delete existing action plan
            await pool.execute(
              'DELETE FROM financial_assistance_action_plan WHERE financial_assistance_id = ?',
              [form.financial_assistance_id]
            );

            // Define period order for sequential numbering
            const periods = ['upto_1st_year_end', '2nd_and_3rd_year', '4th_and_5th_year'];
            let actionNumber = 1;

            // Insert action plan items in order, maintaining sequential numbering
            for (const period of periods) {
              if (data.action_plan[period] && Array.isArray(data.action_plan[period])) {
                for (const item of data.action_plan[period]) {
                  if (item.action_text && item.action_text.trim() !== '') {
                    const actionText = item.action_text.trim();
                    
                    await pool.execute(`
                      INSERT INTO financial_assistance_action_plan (
                        financial_assistance_id, timeline_period, action_number, action_text
                      ) VALUES (?, ?, ?, ?)
                    `, [
                      form.financial_assistance_id, period, actionNumber, actionText
                    ]);
                    
                    actionNumber++;
                  }
                }
              }
            }
          }

          // Handle timeline assistance - save to financial_assistance_timeline_assistance table
          if (data.timeline_assistance && typeof data.timeline_assistance === 'object') {
            // Delete existing timeline assistance for this financial_assistance
            await pool.execute(
              'DELETE FROM financial_assistance_timeline_assistance WHERE financial_assistance_id = ?',
              [form.financial_assistance_id]
            );

            // Define period order for sequential numbering
            const periods = ['immediate', 'after_1st_yr', 'after_2nd_yr', 'after_3rd_yr', 'after_4th_yr', '5th_yr'];
            let actionNumber = 1;

            // Insert timeline assistance items in order, maintaining sequential numbering
            for (const period of periods) {
              if (data.timeline_assistance[period] && Array.isArray(data.timeline_assistance[period])) {
                for (const item of data.timeline_assistance[period]) {
                  // Only insert if at least one field has a value
                  if (item.purpose_cost || item.enayat || item.qardan || item.months) {
                    const purposeCost = item.purpose_cost || null;
                    const enayat = item.enayat && item.enayat !== '' ? parseFloat(item.enayat) : null;
                    const qardan = item.qardan && item.qardan !== '' ? parseFloat(item.qardan) : null;
                    const months = item.months && item.months !== '' ? parseInt(item.months) : null;
                    
                    await pool.execute(`
                      INSERT INTO financial_assistance_timeline_assistance (
                        financial_assistance_id, timeline_period, action_number, purpose_cost, enayat, qardan, months
                      ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                      form.financial_assistance_id, period, actionNumber, purposeCost, enayat, qardan, months
                    ]);
                    
                    actionNumber++;
                  }
                }
              }
            }
          }
        } else {
          // Create new financial assistance
          // Convert undefined values to null for database
          const assistance_required = data.assistance_required === undefined || data.assistance_required === '' ? null : data.assistance_required;
          const self_funding = data.self_funding === undefined || data.self_funding === '' ? null : data.self_funding;
          const rahen_available = data.rahen_available === undefined || data.rahen_available === '' ? null : data.rahen_available;
          const repayment_year1 = data.repayment_schedule?.year1 === undefined || data.repayment_schedule?.year1 === '' ? null : data.repayment_schedule?.year1;
          const repayment_year2 = data.repayment_schedule?.year2 === undefined || data.repayment_schedule?.year2 === '' ? null : data.repayment_schedule?.year2;
          const repayment_year3 = data.repayment_schedule?.year3 === undefined || data.repayment_schedule?.year3 === '' ? null : data.repayment_schedule?.year3;
          const repayment_year4 = data.repayment_schedule?.year4 === undefined || data.repayment_schedule?.year4 === '' ? null : data.repayment_schedule?.year4;
          const repayment_year5 = data.repayment_schedule?.year5 === undefined || data.repayment_schedule?.year5 === '' ? null : data.repayment_schedule?.year5;
          
          const [result] = await pool.execute(`
            INSERT INTO financial_assistance (
              case_id, assistance_required, self_funding, rahen_available,
              repayment_year1, repayment_year2, repayment_year3, repayment_year4, repayment_year5,
              support_needed, support_industry_knowledge_desc, support_sourcing_desc,
              support_sales_market_desc, support_internship_desc,
              support_mentoring_handholding_desc, support_bookkeeping_desc
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            form.case_id, assistance_required, self_funding, rahen_available,
            repayment_year1, repayment_year2, repayment_year3, repayment_year4, repayment_year5,
            JSON.stringify(data.support_needed || []),
            data.support_industry_knowledge_desc || null,
            data.support_sourcing_desc || null,
            data.support_sales_market_desc || null,
            data.support_internship_desc || null,
            data.support_mentoring_handholding_desc || null,
            data.support_bookkeeping_desc || null
          ]);

          // Handle QH fields for new financial assistance
          if (data.qh_fields && Array.isArray(data.qh_fields)) {
            for (const qhField of data.qh_fields) {
              if (qhField.name) {
                // Convert undefined values to null for database
                const year1 = qhField.year1 === undefined || qhField.year1 === '' ? null : qhField.year1;
                const year2 = qhField.year2 === undefined || qhField.year2 === '' ? null : qhField.year2;
                const year3 = qhField.year3 === undefined || qhField.year3 === '' ? null : qhField.year3;
                const year4 = qhField.year4 === undefined || qhField.year4 === '' ? null : qhField.year4;
                const year5 = qhField.year5 === undefined || qhField.year5 === '' ? null : qhField.year5;
                
                await pool.execute(`
                  INSERT INTO financial_assistance_qh_repayment_schedule (
                    financial_assistance_id, qh_name, year1, year2, year3, year4, year5
                  ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                  result.insertId, qhField.name, year1, year2, year3, year4, year5
                ]);
              }
            }
          }

          // Update counseling form with financial assistance ID
          await pool.execute(
            'UPDATE counseling_forms SET financial_assistance_id = ? WHERE id = ?',
            [result.insertId, formId]
          );

          // Handle timeline
          if (data.timeline && Array.isArray(data.timeline)) {
            for (const item of data.timeline) {
              if (item.timeline || item.purpose || item.amount) {
                // Convert undefined values to null for database
                // Map old field names to new column names:
                // item.timeline → purpose column
                // item.purpose → enayat column
                // item.amount → qardan column
                // item.support_document → months column
                const purpose = item.timeline === undefined || item.timeline === '' ? null : item.timeline;
                const enayat = item.purpose === undefined || item.purpose === '' ? null : (item.purpose ? parseFloat(item.purpose) : null);
                const qardan = item.amount === undefined || item.amount === '' ? null : (item.amount ? parseFloat(item.amount) : null);
                const months = item.support_document === undefined || item.support_document === '' ? null : (item.support_document ? parseInt(item.support_document) : null);
                
                await pool.execute(`
                  INSERT INTO financial_assistance_timeline (
                    financial_assistance_id, purpose, enayat, qardan, months
                  ) VALUES (?, ?, ?, ?, ?)
                `, [
                  result.insertId, purpose, enayat, qardan, months
                ]);
              }
            }
          }

          // Handle action plan for new financial assistance
          if (data.action_plan && typeof data.action_plan === 'object') {
            // Define period order for sequential numbering
            const periods = ['upto_1st_year_end', '2nd_and_3rd_year', '4th_and_5th_year'];
            let actionNumber = 1;

            // Insert action plan items in order, maintaining sequential numbering
            for (const period of periods) {
              if (data.action_plan[period] && Array.isArray(data.action_plan[period])) {
                for (const item of data.action_plan[period]) {
                  if (item.action_text && item.action_text.trim() !== '') {
                    const actionText = item.action_text.trim();
                    
                    await pool.execute(`
                      INSERT INTO financial_assistance_action_plan (
                        financial_assistance_id, timeline_period, action_number, action_text
                      ) VALUES (?, ?, ?, ?)
                    `, [
                      result.insertId, period, actionNumber, actionText
                    ]);
                    
                    actionNumber++;
                  }
                }
              }
            }
          }

          // Handle timeline assistance for new financial assistance - save to financial_assistance_timeline_assistance table
          if (data.timeline_assistance && typeof data.timeline_assistance === 'object') {
            // Define period order for sequential numbering
            const periods = ['immediate', 'after_1st_yr', 'after_2nd_yr', 'after_3rd_yr', 'after_4th_yr', '5th_yr'];
            let actionNumber = 1;

            // Insert timeline assistance items in order, maintaining sequential numbering
            for (const period of periods) {
              if (data.timeline_assistance[period] && Array.isArray(data.timeline_assistance[period])) {
                for (const item of data.timeline_assistance[period]) {
                  // Only insert if at least one field has a value
                  if (item.purpose_cost || item.enayat || item.qardan || item.months) {
                    const purposeCost = item.purpose_cost || null;
                    const enayat = item.enayat && item.enayat !== '' ? parseFloat(item.enayat) : null;
                    const qardan = item.qardan && item.qardan !== '' ? parseFloat(item.qardan) : null;
                    const months = item.months && item.months !== '' ? parseInt(item.months) : null;
                    
                    await pool.execute(`
                      INSERT INTO financial_assistance_timeline_assistance (
                        financial_assistance_id, timeline_period, action_number, purpose_cost, enayat, qardan, months
                      ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                      result.insertId, period, actionNumber, purposeCost, enayat, qardan, months
                    ]);
                    
                    actionNumber++;
                  }
                }
              }
            }
          }

          // Handle mentors - save to financial_assistance_mentors table
          if (data.support_mentors && Array.isArray(data.support_mentors)) {
            // Insert mentors for this new financial_assistance
            for (const mentor of data.support_mentors) {
              if (mentor.its_number) {
                await pool.execute(`
                  INSERT INTO financial_assistance_mentors 
                  (financial_assistance_id, its_number, name, contact_number, email, photo)
                  VALUES (?, ?, ?, ?, ?, ?)
                `, [
                  result.insertId,
                  mentor.its_number || '',
                  mentor.name || null,
                  mentor.contact_number || null,
                  mentor.email || null,
                  mentor.photo || null
                ]);
              }
            }
          }
        }
        break;

      case 'economic_growth':
        if (form.economic_growth_id) {
          // Update existing economic growth with business assets and economic growth data
          const businessAssetsFields = [
            'cash_in_hand_last_year', 'cash_in_hand_year1', 'cash_in_hand_year2', 'cash_in_hand_year3', 'cash_in_hand_year4', 'cash_in_hand_year5',
            'raw_materials_last_year', 'raw_materials_year1', 'raw_materials_year2', 'raw_materials_year3', 'raw_materials_year4', 'raw_materials_year5',
            'sale_on_credit_last_year', 'sale_on_credit_year1', 'sale_on_credit_year2', 'sale_on_credit_year3', 'sale_on_credit_year4', 'sale_on_credit_year5',
            'machines_equipment_last_year', 'machines_equipment_year1', 'machines_equipment_year2', 'machines_equipment_year3', 'machines_equipment_year4', 'machines_equipment_year5',
            'vehicles_last_year', 'vehicles_year1', 'vehicles_year2', 'vehicles_year3', 'vehicles_year4', 'vehicles_year5',
            'shop_godown_last_year', 'shop_godown_year1', 'shop_godown_year2', 'shop_godown_year3', 'shop_godown_year4', 'shop_godown_year5',
            'trademark_goodwill_last_year', 'trademark_goodwill_year1', 'trademark_goodwill_year2', 'trademark_goodwill_year3', 'trademark_goodwill_year4', 'trademark_goodwill_year5',
            'purchase_on_credit_last_year', 'purchase_on_credit_year1', 'purchase_on_credit_year2', 'purchase_on_credit_year3', 'purchase_on_credit_year4', 'purchase_on_credit_year5'
          ];

          const economicGrowthFields = [
            // Revenue/Sales fields
            'revenue_sales_last_year', 'revenue_sales_year1', 'revenue_sales_year2', 'revenue_sales_year3', 'revenue_sales_year4', 'revenue_sales_year5',
            
            // Expenses fields
            'expenses_raw_material_last_year', 'expenses_raw_material_year1', 'expenses_raw_material_year2', 'expenses_raw_material_year3', 'expenses_raw_material_year4', 'expenses_raw_material_year5',
            'expenses_labor_salary_last_year', 'expenses_labor_salary_year1', 'expenses_labor_salary_year2', 'expenses_labor_salary_year3', 'expenses_labor_salary_year4', 'expenses_labor_salary_year5',
            'expenses_rent_last_year', 'expenses_rent_year1', 'expenses_rent_year2', 'expenses_rent_year3', 'expenses_rent_year4', 'expenses_rent_year5',
            'expenses_overhead_misc_last_year', 'expenses_overhead_misc_year1', 'expenses_overhead_misc_year2', 'expenses_overhead_misc_year3', 'expenses_overhead_misc_year4', 'expenses_overhead_misc_year5',
            'expenses_repair_maintenance_depreciation_last_year', 'expenses_repair_maintenance_depreciation_year1', 'expenses_repair_maintenance_depreciation_year2', 'expenses_repair_maintenance_depreciation_year3', 'expenses_repair_maintenance_depreciation_year4', 'expenses_repair_maintenance_depreciation_year5',
            'total_expenses_last_year', 'total_expenses_year1', 'total_expenses_year2', 'total_expenses_year3', 'total_expenses_year4', 'total_expenses_year5',
            
            // Profit fields
            'profit_last_year', 'profit_year1', 'profit_year2', 'profit_year3', 'profit_year4', 'profit_year5',
            'profit_fund_blocked_last_year', 'profit_fund_blocked_year1', 'profit_fund_blocked_year2', 'profit_fund_blocked_year3', 'profit_fund_blocked_year4', 'profit_fund_blocked_year5',
            'profit_qardan_repayment_last_year', 'profit_qardan_repayment_year1', 'profit_qardan_repayment_year2', 'profit_qardan_repayment_year3', 'profit_qardan_repayment_year4', 'profit_qardan_repayment_year5',
            'profit_other_income_last_year', 'profit_other_income_year1', 'profit_other_income_year2', 'profit_other_income_year3', 'profit_other_income_year4', 'profit_other_income_year5',
            'profit_household_expense_last_year', 'profit_household_expense_year1', 'profit_household_expense_year2', 'profit_household_expense_year3', 'profit_household_expense_year4', 'profit_household_expense_year5',
            
            // Cash Surplus fields
            'cash_surplus_last_year', 'cash_surplus_year1', 'cash_surplus_year2', 'cash_surplus_year3', 'cash_surplus_year4', 'cash_surplus_year5',
            'cash_surplus_additional_enayat_last_year', 'cash_surplus_additional_enayat_year1', 'cash_surplus_additional_enayat_year2', 'cash_surplus_additional_enayat_year3', 'cash_surplus_additional_enayat_year4', 'cash_surplus_additional_enayat_year5',
            'cash_surplus_additional_qardan_last_year', 'cash_surplus_additional_qardan_year1', 'cash_surplus_additional_qardan_year2', 'cash_surplus_additional_qardan_year3', 'cash_surplus_additional_qardan_year4', 'cash_surplus_additional_qardan_year5'
          ];

          const allFields = [...businessAssetsFields, ...economicGrowthFields];

          const updateFields = [];
          const updateValues = [];

          allFields.forEach(field => {
            if (data[field] !== undefined) {
              updateFields.push(`${field} = ?`);
              updateValues.push(data[field] || 0);
            }
          });

          if (updateFields.length > 0) {
            updateValues.push(form.economic_growth_id);
            await pool.execute(
              `UPDATE economic_growth SET ${updateFields.join(', ')} WHERE id = ?`,
              updateValues
            );
          }

          // Handle projections
          if (data.projections && Array.isArray(data.projections)) {
            // Delete existing projections
            await pool.execute(
              'DELETE FROM economic_growth_projections WHERE economic_growth_id = ?',
              [form.economic_growth_id]
            );

            // Insert new projections
            for (const projection of data.projections) {
              if (projection.category || projection.present || projection.year1) {
                await pool.execute(`
                  INSERT INTO economic_growth_projections (
                    economic_growth_id, category, present, year1, year2, year3, year4, year5
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                  form.economic_growth_id, projection.category, projection.present,
                  projection.year1, projection.year2, projection.year3, projection.year4, projection.year5
                ]);
              }
            }
          }
        } else {
          // Create new economic growth with business assets and economic growth data
          const businessAssetsFields = [
            'cash_in_hand_last_year', 'cash_in_hand_year1', 'cash_in_hand_year2', 'cash_in_hand_year3', 'cash_in_hand_year4', 'cash_in_hand_year5',
            'raw_materials_last_year', 'raw_materials_year1', 'raw_materials_year2', 'raw_materials_year3', 'raw_materials_year4', 'raw_materials_year5',
            'sale_on_credit_last_year', 'sale_on_credit_year1', 'sale_on_credit_year2', 'sale_on_credit_year3', 'sale_on_credit_year4', 'sale_on_credit_year5',
            'machines_equipment_last_year', 'machines_equipment_year1', 'machines_equipment_year2', 'machines_equipment_year3', 'machines_equipment_year4', 'machines_equipment_year5',
            'vehicles_last_year', 'vehicles_year1', 'vehicles_year2', 'vehicles_year3', 'vehicles_year4', 'vehicles_year5',
            'shop_godown_last_year', 'shop_godown_year1', 'shop_godown_year2', 'shop_godown_year3', 'shop_godown_year4', 'shop_godown_year5',
            'trademark_goodwill_last_year', 'trademark_goodwill_year1', 'trademark_goodwill_year2', 'trademark_goodwill_year3', 'trademark_goodwill_year4', 'trademark_goodwill_year5',
            'purchase_on_credit_last_year', 'purchase_on_credit_year1', 'purchase_on_credit_year2', 'purchase_on_credit_year3', 'purchase_on_credit_year4', 'purchase_on_credit_year5'
          ];

          const economicGrowthFields = [
            // Revenue/Sales fields
            'revenue_sales_last_year', 'revenue_sales_year1', 'revenue_sales_year2', 'revenue_sales_year3', 'revenue_sales_year4', 'revenue_sales_year5',
            
            // Expenses fields
            'expenses_raw_material_last_year', 'expenses_raw_material_year1', 'expenses_raw_material_year2', 'expenses_raw_material_year3', 'expenses_raw_material_year4', 'expenses_raw_material_year5',
            'expenses_labor_salary_last_year', 'expenses_labor_salary_year1', 'expenses_labor_salary_year2', 'expenses_labor_salary_year3', 'expenses_labor_salary_year4', 'expenses_labor_salary_year5',
            'expenses_rent_last_year', 'expenses_rent_year1', 'expenses_rent_year2', 'expenses_rent_year3', 'expenses_rent_year4', 'expenses_rent_year5',
            'expenses_overhead_misc_last_year', 'expenses_overhead_misc_year1', 'expenses_overhead_misc_year2', 'expenses_overhead_misc_year3', 'expenses_overhead_misc_year4', 'expenses_overhead_misc_year5',
            'expenses_repair_maintenance_depreciation_last_year', 'expenses_repair_maintenance_depreciation_year1', 'expenses_repair_maintenance_depreciation_year2', 'expenses_repair_maintenance_depreciation_year3', 'expenses_repair_maintenance_depreciation_year4', 'expenses_repair_maintenance_depreciation_year5',
            'total_expenses_last_year', 'total_expenses_year1', 'total_expenses_year2', 'total_expenses_year3', 'total_expenses_year4', 'total_expenses_year5',
            
            // Profit fields
            'profit_last_year', 'profit_year1', 'profit_year2', 'profit_year3', 'profit_year4', 'profit_year5',
            'profit_fund_blocked_last_year', 'profit_fund_blocked_year1', 'profit_fund_blocked_year2', 'profit_fund_blocked_year3', 'profit_fund_blocked_year4', 'profit_fund_blocked_year5',
            'profit_qardan_repayment_last_year', 'profit_qardan_repayment_year1', 'profit_qardan_repayment_year2', 'profit_qardan_repayment_year3', 'profit_qardan_repayment_year4', 'profit_qardan_repayment_year5',
            'profit_other_income_last_year', 'profit_other_income_year1', 'profit_other_income_year2', 'profit_other_income_year3', 'profit_other_income_year4', 'profit_other_income_year5',
            'profit_household_expense_last_year', 'profit_household_expense_year1', 'profit_household_expense_year2', 'profit_household_expense_year3', 'profit_household_expense_year4', 'profit_household_expense_year5',
            
            // Cash Surplus fields
            'cash_surplus_last_year', 'cash_surplus_year1', 'cash_surplus_year2', 'cash_surplus_year3', 'cash_surplus_year4', 'cash_surplus_year5',
            'cash_surplus_additional_enayat_last_year', 'cash_surplus_additional_enayat_year1', 'cash_surplus_additional_enayat_year2', 'cash_surplus_additional_enayat_year3', 'cash_surplus_additional_enayat_year4', 'cash_surplus_additional_enayat_year5',
            'cash_surplus_additional_qardan_last_year', 'cash_surplus_additional_qardan_year1', 'cash_surplus_additional_qardan_year2', 'cash_surplus_additional_qardan_year3', 'cash_surplus_additional_qardan_year4', 'cash_surplus_additional_qardan_year5'
          ];

          const allFields = [...businessAssetsFields, ...economicGrowthFields];

          const insertFields = ['case_id'];
          const insertValues = [form.case_id];
          const placeholders = ['?'];

          allFields.forEach(field => {
            insertFields.push(field);
            insertValues.push(data[field] || 0);
            placeholders.push('?');
          });

          const [result] = await pool.execute(
            `INSERT INTO economic_growth (${insertFields.join(', ')}) VALUES (${placeholders.join(', ')})`,
            insertValues
          );

          // Update counseling form with economic growth ID
          await pool.execute(
            'UPDATE counseling_forms SET economic_growth_id = ? WHERE id = ?',
            [result.insertId, formId]
          );

          // Handle projections
          if (data.projections && Array.isArray(data.projections)) {
            for (const projection of data.projections) {
              if (projection.category || projection.present || projection.year1) {
                await pool.execute(`
                  INSERT INTO economic_growth_projections (
                    economic_growth_id, category, present, year1, year2, year3, year4, year5
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                  result.insertId, projection.category, projection.present,
                  projection.year1, projection.year2, projection.year3, projection.year4, projection.year5
                ]);
              }
            }
          }
        }
        break;

      case 'declaration':
        // Helper function to convert undefined and empty strings to null
        const toNull = (value) => (value === undefined || value === '') ? null : value;
        
        // Auto-populate applicant_its from personal_details if not provided
        if (!data.applicant_its && form.personal_details_id) {
          const [personalDetailsData] = await pool.execute(
            'SELECT its_number FROM personal_details WHERE id = ?',
            [form.personal_details_id]
          );
          if (personalDetailsData.length > 0 && personalDetailsData[0].its_number) {
            data.applicant_its = personalDetailsData[0].its_number;
          }
        }
        
        // Auto-populate counselor_its from assigned counselor if not provided
        if (!data.counselor_its && form.case_id) {
          const [caseData] = await pool.execute(
            `SELECT c.assigned_counselor_id, u.its_number
             FROM cases c
             LEFT JOIN users u ON c.assigned_counselor_id = u.id
             WHERE c.id = ?`,
            [form.case_id]
          );
          if (caseData.length > 0 && caseData[0].its_number) {
            data.counselor_its = caseData[0].its_number;
          }
        }
        
        if (form.declaration_id) {
          // Update existing declaration
          await pool.execute(`
            UPDATE declaration SET
              applicant_confirmation = ?, applicant_its = ?, applicant_name = ?, applicant_contact = ?, declaration_date = ?,
              signature_type = ?, signature_file_path = ?, signature_drawing_data = ?,
              other_comments = ?, applicant_signature = ?,
              counselor_confirmation = ?, counselor_its = ?, counselor_name = ?, counselor_contact = ?, counselor_date = ?,
              counselor_signature_type = ?, counselor_comments = ?, counselor_signature = ?,
              counselor_signature_file_path = ?, counselor_signature_drawing_data = ?,
              tr_committee_its = ?, tr_committee_name = ?, tr_committee_contact = ?, tr_committee_date = ?,
              tr_committee_signature_type = ?, tr_committee_signature_file_path = ?, tr_committee_signature_drawing_data = ?,
              tr_committee_signature = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [
            toNull(data.applicant_confirmation), toNull(data.applicant_its), toNull(data.applicant_name), toNull(data.applicant_contact), toNull(data.declaration_date),
            toNull(data.signature_type), toNull(data.signature_file_path), toNull(data.signature_drawing_data),
            toNull(data.other_comments), toNull(data.applicant_signature),
            toNull(data.counselor_confirmation), toNull(data.counselor_its), toNull(data.counselor_name), toNull(data.counselor_contact), toNull(data.counselor_date),
            toNull(data.counselor_signature_type), toNull(data.counselor_comments), toNull(data.counselor_signature),
            toNull(data.counselor_signature_file_path), toNull(data.counselor_signature_drawing_data),
            toNull(data.tr_committee_its), toNull(data.tr_committee_name), toNull(data.tr_committee_contact), toNull(data.tr_committee_date),
            toNull(data.tr_committee_signature_type), toNull(data.tr_committee_signature_file_path), toNull(data.tr_committee_signature_drawing_data),
            toNull(data.tr_committee_signature), form.declaration_id
          ]);
        } else {
          // Create new declaration
          const [result] = await pool.execute(`
            INSERT INTO declaration (
              case_id, applicant_confirmation, applicant_its, applicant_name, applicant_contact, declaration_date,
              signature_type, signature_file_path, signature_drawing_data,
              other_comments, applicant_signature,
              counselor_confirmation, counselor_its, counselor_name, counselor_contact, counselor_date,
              counselor_signature_type, counselor_comments, counselor_signature,
              counselor_signature_file_path, counselor_signature_drawing_data,
              tr_committee_its, tr_committee_name, tr_committee_contact, tr_committee_date,
              tr_committee_signature_type, tr_committee_signature_file_path, tr_committee_signature_drawing_data,
              tr_committee_signature
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            form.case_id, toNull(data.applicant_confirmation), toNull(data.applicant_its), toNull(data.applicant_name), toNull(data.applicant_contact), toNull(data.declaration_date),
            toNull(data.signature_type), toNull(data.signature_file_path), toNull(data.signature_drawing_data),
            toNull(data.other_comments), toNull(data.applicant_signature),
            toNull(data.counselor_confirmation), toNull(data.counselor_its), toNull(data.counselor_name), toNull(data.counselor_contact), toNull(data.counselor_date),
            toNull(data.counselor_signature_type), toNull(data.counselor_comments), toNull(data.counselor_signature),
            toNull(data.counselor_signature_file_path), toNull(data.counselor_signature_drawing_data),
            toNull(data.tr_committee_its), toNull(data.tr_committee_name), toNull(data.tr_committee_contact), toNull(data.tr_committee_date),
            toNull(data.tr_committee_signature_type), toNull(data.tr_committee_signature_file_path), toNull(data.tr_committee_signature_drawing_data),
            toNull(data.tr_committee_signature)
          ]);

          // Update counseling form with declaration ID
          await pool.execute(
            'UPDATE counseling_forms SET declaration_id = ? WHERE id = ?',
            [result.insertId, formId]
          );
        }
        break;

      case 'attachments':
        if (form.attachments_id) {
          // Update existing attachments by ID
          await pool.execute(`
            UPDATE attachments SET
              work_place_photo = ?, quotation = ?, product_brochure = ?,
              income_tax_return = ?, financial_statements = ?, other_documents = ?,
              cancelled_cheque = ?, pan_card = ?, aadhar_card = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [
            data.work_place_photo ? 1 : 0, data.quotation ? 1 : 0, data.product_brochure ? 1 : 0,
            data.income_tax_return ? 1 : 0, data.financial_statements ? 1 : 0, data.other_documents ? 1 : 0,
            data.cancelled_cheque ? 1 : 0, data.pan_card ? 1 : 0, data.aadhar_card ? 1 : 0,
            form.attachments_id
          ]);
        } else {
          // Use INSERT ... ON DUPLICATE KEY UPDATE to handle race conditions
          // This will insert if the record doesn't exist, or update if it does (based on unique case_id constraint)
          const [result] = await pool.execute(`
            INSERT INTO attachments (
              case_id, work_place_photo, quotation, product_brochure,
              income_tax_return, financial_statements, other_documents,
              cancelled_cheque, pan_card, aadhar_card
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              work_place_photo = VALUES(work_place_photo),
              quotation = VALUES(quotation),
              product_brochure = VALUES(product_brochure),
              income_tax_return = VALUES(income_tax_return),
              financial_statements = VALUES(financial_statements),
              other_documents = VALUES(other_documents),
              cancelled_cheque = VALUES(cancelled_cheque),
              pan_card = VALUES(pan_card),
              aadhar_card = VALUES(aadhar_card),
              updated_at = CURRENT_TIMESTAMP
          `, [
            form.case_id, data.work_place_photo ? 1 : 0, data.quotation ? 1 : 0, data.product_brochure ? 1 : 0,
            data.income_tax_return ? 1 : 0, data.financial_statements ? 1 : 0, data.other_documents ? 1 : 0,
            data.cancelled_cheque ? 1 : 0, data.pan_card ? 1 : 0, data.aadhar_card ? 1 : 0
          ]);

          // Get the attachments ID (either from insert or existing record)
          let attachmentsId = result.insertId;
          if (result.insertId === 0) {
            // If insertId is 0, it means the record already existed and was updated
            // Fetch the existing record's ID
            const [existing] = await pool.execute(
              'SELECT id FROM attachments WHERE case_id = ?',
              [form.case_id]
            );
            if (existing.length > 0) {
              attachmentsId = existing[0].id;
            }
          }

          // Update counseling form with attachments ID if we got one
          if (attachmentsId) {
            await pool.execute(
              'UPDATE counseling_forms SET attachments_id = ? WHERE id = ?',
              [attachmentsId, formId]
            );
          }
        }
        break;

      default:
        return res.status(400).json({ error: 'Invalid section' });
    }

    // Update case status based on completed sections
    await updateCaseStatusBasedOnProgress(form.case_id);

    res.json({ message: 'Section updated successfully' });
  } catch (error) {
    console.error('Update section error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request data:', req.body);
    console.error('Request params:', req.params);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Complete counseling form and submit to welfare department
router.put('/:formId/complete', authenticateToken, async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get the counseling form and case details
    const [forms] = await pool.execute(
      `SELECT cf.*, c.id as case_id, c.status, c.roles as assigned_dcm_id, c.assigned_counselor_id, c.case_number,
              SUBSTRING_INDEX(a.full_name, ' ', 1) as first_name,
              SUBSTRING_INDEX(a.full_name, ' ', -1) as last_name,
              a.full_name,
              a.its_number
       FROM counseling_forms cf 
       JOIN cases c ON cf.case_id = c.id 
       JOIN applicants a ON c.applicant_id = a.id
       WHERE cf.id = ?`,
      [formId]
    );

    if (forms.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = forms[0];

    // Check permissions - use permission-based check instead of hardcoded roles
    const canComplete = await hasPermission(userRole, 'counseling_forms', 'complete');
    
    if (!canComplete) {
      return res.status(403).json({ error: 'You do not have permission to complete forms' });
    }

    // Check if user is assigned to this case
    // Note: roles field in cases table stores the assigned DCM user ID
    if (userRole !== 'admin' && userRole !== 'super_admin' && form.assigned_dcm_id !== userId) {
      return res.status(403).json({ error: 'You can only complete forms for cases assigned to you' });
    }

    // Validate that all required sections are completed
    const requiredSections = [
      'personal_details',
      'family_details', 
      'assessment',
      'financial_assistance',
      'economic_growth',
      'declaration',
      'attachments'
    ];

    const missingSections = requiredSections.filter(section => !form[section + '_id']);
    if (missingSections.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot complete form. Missing sections: ' + missingSections.join(', ')
      });
    }

    // Get a connection for transaction
    const connection = await pool.getConnection();

    try {
      // Start transaction
      await connection.beginTransaction();

      // Mark form as complete
      await connection.execute(
        'UPDATE counseling_forms SET is_complete = TRUE, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        [formId]
      );

      // Get case type for workflow stage lookup
      const [caseInfo] = await connection.execute(
        'SELECT case_type_id FROM cases WHERE id = ?',
        [form.case_id]
      );
      const caseTypeId = caseInfo.length > 0 ? caseInfo[0].case_type_id : null;

      // Update workflow stage (move to welfare review)
      const [stages] = await connection.execute(
        'SELECT id, stage_name, associated_statuses FROM workflow_stages WHERE stage_key = ? AND is_active = TRUE AND (case_type_id = ? OR (case_type_id IS NULL AND ? IS NULL)) ORDER BY CASE WHEN case_type_id IS NULL THEN 1 ELSE 0 END LIMIT 1',
        ['welfare_review', caseTypeId, caseTypeId]
      );
      
      let newStatus = 'submitted_to_welfare'; // Default fallback
      
      if (stages.length > 0) {
        const stageId = stages[0].id;
        const stageName = stages[0].stage_name;
        
        // Get associated_statuses from the stage
        let associatedStatuses = [];
        if (stages[0].associated_statuses) {
          try {
            associatedStatuses = JSON.parse(stages[0].associated_statuses);
          } catch (e) {
            associatedStatuses = Array.isArray(stages[0].associated_statuses) ? stages[0].associated_statuses : [];
          }
        }
        
        // Use the first associated status if available, otherwise use default
        if (associatedStatuses.length > 0) {
          newStatus = associatedStatuses[0];
        }
        
        // Get current workflow history and status
        const [currentCase] = await connection.execute(
          'SELECT workflow_history, current_workflow_stage_id, status FROM cases WHERE id = ?',
          [form.case_id]
        );
        
        const oldStatus = currentCase.length > 0 ? currentCase[0].status : form.status;
        
        // Update case status based on workflow stage's associated_statuses
        await connection.execute(
          'UPDATE cases SET status = ? WHERE id = ?',
          [newStatus, form.case_id]
        );
        
        // Skip if already in this stage
        if (currentCase.length > 0 && currentCase[0].current_workflow_stage_id === stageId) {
          // Already in correct stage, but status might need updating
        } else {
          let workflowHistory = [];
          if (currentCase.length > 0 && currentCase[0].workflow_history) {
            try {
              workflowHistory = JSON.parse(currentCase[0].workflow_history);
            } catch (e) {
              workflowHistory = [];
            }
          }
          
          // Add new entry
          const [userInfo] = await connection.execute(
            'SELECT full_name, username FROM users WHERE id = ?',
            [userId]
          );
          const userName = userInfo.length > 0 ? (userInfo[0].full_name || userInfo[0].username) : 'Unknown';
          
          workflowHistory.push({
            stage_id: stageId,
            stage_name: stageName,
            entered_at: new Date().toISOString(),
            entered_by: userId,
            entered_by_name: userName,
            action: 'form_completed'
          });
          
          // Update case workflow stage
          await connection.execute(
            'UPDATE cases SET current_workflow_stage_id = ?, workflow_history = ? WHERE id = ?',
            [stageId, JSON.stringify(workflowHistory), form.case_id]
          );
        }
        
        // Log status change in status_history
        if (oldStatus !== newStatus) {
          await connection.execute(
            `INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments) 
             VALUES (?, ?, ?, ?, ?)`,
            [form.case_id, oldStatus, newStatus, userId, 'Case completed and submitted to welfare department']
          );
        }
      } else {
        // No workflow stage found, use default status update
        await connection.execute(
          'UPDATE cases SET status = ? WHERE id = ?',
          [newStatus, form.case_id]
        );
        
        // Log status change in status_history
        await connection.execute(
          `INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments) 
           VALUES (?, ?, ?, ?, ?)`,
          [form.case_id, form.status, newStatus, userId, 'Case completed and submitted to welfare department']
        );
      }

      // Add completion comment
      await connection.execute(
        `INSERT INTO case_comments (case_id, user_id, comment, comment_type) 
         VALUES (?, ?, ?, ?)`,
        [form.case_id, userId, `Case completed and submitted to welfare department for review. Case: ${form.case_number}`, 'approval']
      );

      // Create notifications for welfare department users
      const [welfareUsers] = await connection.execute(
        'SELECT id FROM users WHERE role = "welfare_reviewer" AND is_active = TRUE'
      );

      for (const welfareUser of welfareUsers) {
        await connection.execute(
          `INSERT INTO notifications (user_id, case_id, title, message, type) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            welfareUser.id,
            form.case_id,
            'New Case for Review',
            `Case ${form.case_number} for ${form.full_name || (form.first_name && form.last_name ? `${form.first_name} ${form.last_name}`.trim() : 'Applicant')} (ITS: ${form.its_number || ''}) has been submitted for welfare department review.`,
            'info'
          ]
        );
      }

      // Commit transaction
      await connection.commit();

      res.json({ 
        message: 'Counseling form completed successfully and submitted to welfare department',
        caseId: form.case_id,
        caseNumber: form.case_number
      });

    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      throw error;
    } finally {
      // Release connection back to pool
      connection.release();
    }

  } catch (error) {
    console.error('Complete form error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      formId: req.params.formId,
      userId: req.user?.id,
      userRole: req.user?.role
    });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;
