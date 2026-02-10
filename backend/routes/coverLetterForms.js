const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeCaseAccess } = require('../middleware/auth');
const { authorizePermission } = require('../middleware/auth');
const { hasPermission } = require('../utils/permissionUtils');
const notificationService = require('../services/notificationService');

const router = express.Router();

// Helper function to update workflow stage
const updateCaseWorkflowStage = async (caseId, newStatus, userId, userName, action = 'status_changed', caseTypeId = null, preferredStageId = null) => {
  try {
    // Truncate status to fit database column (typically VARCHAR(20))
    if (newStatus && newStatus.length > 20) {
      const originalStatus = newStatus;
      newStatus = newStatus.substring(0, 20);
      console.warn(`Status truncated in updateCaseWorkflowStage from ${originalStatus.length} to 20 chars: ${originalStatus} -> ${newStatus}`);
    }
    
    const [currentCase] = await pool.execute(
      'SELECT current_workflow_stage_id, case_type_id FROM cases WHERE id = ?',
      [caseId]
    );
    
    const currentStageId = currentCase.length > 0 ? currentCase[0].current_workflow_stage_id : null;
    const actualCaseTypeId = caseTypeId || (currentCase.length > 0 ? currentCase[0].case_type_id : null);
    
    let newStageId = preferredStageId;
    if (!newStageId) {
      // Get next stage using sort_order
      const [currentStage] = await pool.execute(
        'SELECT sort_order FROM workflow_stages WHERE id = ? AND is_active = TRUE',
        [currentStageId]
      );
      
      if (currentStage.length > 0) {
        const [nextStages] = await pool.execute(
          `SELECT * FROM workflow_stages 
           WHERE is_active = TRUE AND sort_order > ? 
           AND (case_type_id = ? OR case_type_id IS NULL)
           ORDER BY CASE WHEN case_type_id IS NULL THEN 1 ELSE 0 END, sort_order ASC LIMIT 1`,
          [currentStage[0].sort_order, actualCaseTypeId]
        );
        
        if (nextStages.length > 0) {
          newStageId = nextStages[0].id;
        }
      }
    }
    
    if (!newStageId) {
      console.log(`No workflow stage found for status: ${newStatus}, case: ${caseId}`);
      return;
    }

    const [caseData] = await pool.execute(
      'SELECT workflow_history, status FROM cases WHERE id = ?',
      [caseId]
    );

    if (caseData.length === 0) return;
    
    if (currentStageId === newStageId && caseData[0].status === newStatus) {
      return;
    }
    
    if (!caseData[0].status || caseData[0].status !== newStatus) {
      await pool.execute(
        'UPDATE cases SET status = ? WHERE id = ?',
        [newStatus, caseId]
      );
    }

    const [stageInfo] = await pool.execute(
      'SELECT stage_name FROM workflow_stages WHERE id = ?',
      [newStageId]
    );

    const stageName = stageInfo.length > 0 ? stageInfo[0].stage_name : 'Unknown Stage';

    let workflowHistory = [];
    try {
      const existingHistory = caseData[0].workflow_history;
      if (existingHistory) {
        workflowHistory = JSON.parse(existingHistory);
      }
    } catch (e) {
      workflowHistory = [];
    }

    workflowHistory.push({
      stage_id: newStageId,
      stage_name: stageName,
      entered_at: new Date().toISOString(),
      entered_by: userId,
      entered_by_name: userName,
      action: action
    });

    await pool.execute(
      'UPDATE cases SET current_workflow_stage_id = ?, workflow_history = ? WHERE id = ?',
      [newStageId, JSON.stringify(workflowHistory), caseId]
    );
  } catch (error) {
    console.error('Error updating case workflow stage:', error);
  }
};

// Helper function to fetch applicant data from case
const fetchApplicantData = async (caseId) => {
  try {
    const [caseData] = await pool.execute(`
      SELECT 
        a.full_name,
        a.age,
        a.phone,
        a.its_number,
        a.photo,
        a.jamiat_name,
        a.jamaat_name,
        c.case_number
      FROM cases c
      JOIN applicants a ON c.applicant_id = a.id
      WHERE c.id = ?
    `, [caseId]);

    if (caseData.length === 0) {
      return null;
    }

    return {
      name: caseData[0].full_name || '',
      age: caseData[0].age || null,
      contact_number: caseData[0].phone || '',
      its: caseData[0].its_number || '',
      case_id: caseData[0].case_number || '',
      photo: caseData[0].photo || null,
      jamiat: caseData[0].jamiat_name || '',
      jamaat: caseData[0].jamaat_name || ''
    };
  } catch (error) {
    console.error('Error fetching applicant data:', error);
    return null;
  }
};

// Helper function to fetch counselor data from case
const fetchCounselorData = async (caseId) => {
  try {
    const [caseData] = await pool.execute(`
      SELECT 
        u.full_name,
        u.phone,
        u.email,
        u.photo,
        u.its_number,
        u.jamiat_ids,
        u.jamaat_ids
      FROM cases c
      LEFT JOIN users u ON c.assigned_counselor_id = u.id
      WHERE c.id = ?
    `, [caseId]);

    if (caseData.length === 0 || !caseData[0].full_name) {
      return null;
    }

    let jamiatName = '';
    let jamaatName = '';

    // Get first jamiat name if jamiat_ids exists
    if (caseData[0].jamiat_ids) {
      const jamiatIdArray = caseData[0].jamiat_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (jamiatIdArray.length > 0) {
        try {
          const [jamiatResult] = await pool.execute(
            'SELECT name FROM jamiat WHERE id = ? AND is_active = 1 LIMIT 1',
            [jamiatIdArray[0]]
          );
          if (jamiatResult.length > 0) {
            jamiatName = jamiatResult[0].name || '';
          }
        } catch (jamiatError) {
          console.error('Error fetching jamiat name:', jamiatError);
        }
      }
    }

    // Get first jamaat name if jamaat_ids exists
    if (caseData[0].jamaat_ids) {
      const jamaatIdArray = caseData[0].jamaat_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (jamaatIdArray.length > 0) {
        try {
          const [jamaatResult] = await pool.execute(
            'SELECT name FROM jamaat WHERE id = ? AND is_active = 1 LIMIT 1',
            [jamaatIdArray[0]]
          );
          if (jamaatResult.length > 0) {
            jamaatName = jamaatResult[0].name || '';
          }
        } catch (jamaatError) {
          console.error('Error fetching jamaat name:', jamaatError);
        }
      }
    }

    return {
      name: caseData[0].full_name || '',
      contact_number: caseData[0].phone || caseData[0].email || '',
      its: caseData[0].its_number || '',
      photo: caseData[0].photo || null,
      jamiat: jamiatName,
      jamaat: jamaatName
    };
  } catch (error) {
    console.error('Error fetching counselor data:', error);
    return null;
  }
};

// Helper function to fetch family financial data from counseling form
const fetchFamilyFinancialData = async (caseId) => {
  try {
    // Get counseling form's family_details_id
    const [counselingForms] = await pool.execute(
      'SELECT family_details_id FROM counseling_forms WHERE case_id = ?',
      [caseId]
    );

    if (counselingForms.length === 0 || !counselingForms[0].family_details_id) {
      return {
        current_personal_income: null,
        current_family_income: null,
        earning_family_members: null,
        dependents: null
      };
    }

    const familyDetailsId = counselingForms[0].family_details_id;

    // Query to get financial data from family members
    const [financialData] = await pool.execute(`
      SELECT 
        -- Personal Income (Self)
        (SELECT annual_income FROM family_members fm
         JOIN relations r ON fm.relation_id = r.id
         WHERE fm.family_details_id = ? AND LOWER(r.name) = 'self'
         LIMIT 1) as personal_income,
        
        -- Family Income (Sum of all earning members)
        COALESCE(SUM(CASE WHEN annual_income > 0 THEN annual_income ELSE 0 END), 0) as family_income,
        
        -- Earning Family Members Count
        COUNT(CASE WHEN annual_income > 0 AND annual_income IS NOT NULL THEN 1 END) as earning_members,
        
        -- Dependents Count
        COUNT(CASE WHEN (annual_income = 0 OR annual_income IS NULL) THEN 1 END) as dependents
      FROM family_members
      WHERE family_details_id = ?
    `, [familyDetailsId, familyDetailsId]);

    if (financialData.length === 0) {
      return {
        current_personal_income: null,
        current_family_income: null,
        earning_family_members: null,
        dependents: null
      };
    }

    const data = financialData[0];
    return {
      current_personal_income: data.personal_income ? parseFloat(data.personal_income) : null,
      current_family_income: data.family_income ? parseFloat(data.family_income) : null,
      earning_family_members: data.earning_members ? parseInt(data.earning_members) : null,
      dependents: data.dependents ? parseInt(data.dependents) : null
    };
  } catch (error) {
    console.error('Error fetching family financial data:', error);
    return {
      current_personal_income: null,
      current_family_income: null,
      earning_family_members: null,
      dependents: null
    };
  }
};

// Helper function to fetch economic growth profit data
const fetchEconomicGrowthProfit = async (caseId) => {
  try {
    // Get counseling form's economic_growth_id
    const [counselingForms] = await pool.execute(
      'SELECT economic_growth_id FROM counseling_forms WHERE case_id = ?',
      [caseId]
    );

    if (counselingForms.length === 0 || !counselingForms[0].economic_growth_id) {
      return {
        profit_year1: null,
        profit_year2: null,
        profit_year3: null,
        profit_year4: null,
        profit_year5: null
      };
    }

    const economicGrowthId = counselingForms[0].economic_growth_id;

    // Query to get profit data from economic_growth table
    const [profitData] = await pool.execute(`
      SELECT 
        profit_year1,
        profit_year2,
        profit_year3,
        profit_year4,
        profit_year5
      FROM economic_growth
      WHERE id = ?
    `, [economicGrowthId]);

    if (profitData.length === 0) {
      return {
        profit_year1: null,
        profit_year2: null,
        profit_year3: null,
        profit_year4: null,
        profit_year5: null
      };
    }

    const data = profitData[0];
    return {
      profit_year1: data.profit_year1 ? parseFloat(data.profit_year1) : null,
      profit_year2: data.profit_year2 ? parseFloat(data.profit_year2) : null,
      profit_year3: data.profit_year3 ? parseFloat(data.profit_year3) : null,
      profit_year4: data.profit_year4 ? parseFloat(data.profit_year4) : null,
      profit_year5: data.profit_year5 ? parseFloat(data.profit_year5) : null
    };
  } catch (error) {
    console.error('Error fetching economic growth profit:', error);
    return {
      profit_year1: null,
      profit_year2: null,
      profit_year3: null,
      profit_year4: null,
      profit_year5: null
    };
  }
};

// Helper function to fetch financial assistance totals from timeline_assistance
const fetchFinancialAssistanceTotals = async (caseId) => {
  try {
    // Get counseling form's financial_assistance_id
    const [counselingForms] = await pool.execute(
      'SELECT financial_assistance_id FROM counseling_forms WHERE case_id = ?',
      [caseId]
    );

    if (counselingForms.length === 0 || !counselingForms[0].financial_assistance_id) {
      return {
        total_enayat: null,
        total_qardan: null
      };
    }

    const financialAssistanceId = counselingForms[0].financial_assistance_id;

    // Query to get total Enayat and Qardan from timeline_assistance
    const [totalsData] = await pool.execute(`
      SELECT 
        COALESCE(SUM(enayat), 0) as total_enayat,
        COALESCE(SUM(qardan), 0) as total_qardan
      FROM financial_assistance_timeline_assistance
      WHERE financial_assistance_id = ?
        AND (enayat IS NOT NULL OR qardan IS NOT NULL)
    `, [financialAssistanceId]);

    if (totalsData.length === 0) {
      return {
        total_enayat: null,
        total_qardan: null
      };
    }

    const data = totalsData[0];
    return {
      total_enayat: data.total_enayat ? parseFloat(data.total_enayat) : null,
      total_qardan: data.total_qardan ? parseFloat(data.total_qardan) : null
    };
  } catch (error) {
    console.error('Error fetching financial assistance totals:', error);
    return {
      total_enayat: null,
      total_qardan: null
    };
  }
};

// Helper function to fetch present occupation from personal details
const fetchPersonalOccupation = async (caseId) => {
  try {
    // Get counseling form's personal_details_id
    const [counselingForms] = await pool.execute(
      'SELECT personal_details_id FROM counseling_forms WHERE case_id = ?',
      [caseId]
    );

    if (counselingForms.length === 0 || !counselingForms[0].personal_details_id) {
      return null;
    }

    const personalDetailsId = counselingForms[0].personal_details_id;

    // Query to get present_occupation from personal_details
    const [personalDetailsData] = await pool.execute(`
      SELECT present_occupation
      FROM personal_details
      WHERE id = ?
    `, [personalDetailsId]);

    if (personalDetailsData.length === 0 || !personalDetailsData[0].present_occupation) {
      return null;
    }

    return personalDetailsData[0].present_occupation.trim() || null;
  } catch (error) {
    console.error('Error fetching personal occupation:', error);
    return null;
  }
};

// Helper function to fetch family assets and liabilities from counseling form
const fetchFamilyAssetsAndLiabilities = async (caseId) => {
  try {
    // Get counseling form's family_details_id
    const [counselingForms] = await pool.execute(
      'SELECT family_details_id FROM counseling_forms WHERE case_id = ?',
      [caseId]
    );

    if (counselingForms.length === 0 || !counselingForms[0].family_details_id) {
      return {
        asset_house: null,
        asset_shop: null,
        asset_gold: null,
        asset_machinery: null,
        asset_stock: null,
        liability_qardan: null,
        liability_den: null,
        liability_others: null
      };
    }

    const familyDetailsId = counselingForms[0].family_details_id;

    // Query to get assets and liabilities from family_details
    const [assetsLiabilitiesData] = await pool.execute(`
      SELECT 
        assets_residential,
        assets_shop_godown_land,
        assets_machinery_vehicle,
        assets_stock_raw_material,
        assets_others,
        liabilities_borrowing_qardan,
        liabilities_goods_credit,
        liabilities_others
      FROM family_details
      WHERE id = ?
    `, [familyDetailsId]);

    if (assetsLiabilitiesData.length === 0) {
      return {
        asset_house: null,
        asset_shop: null,
        asset_gold: null,
        asset_machinery: null,
        asset_stock: null,
        liability_qardan: null,
        liability_den: null,
        liability_others: null
      };
    }

    const data = assetsLiabilitiesData[0];
    
    // Helper function to parse value to DECIMAL (for liabilities)
    const parseDecimal = (value) => {
      if (value === null || value === undefined || value === '') return null;
      if (value === '0' || value === 0) return null; // Return null for 0 values
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    };

    // Helper function to get text value (for assets - VARCHAR)
    const getTextValue = (value) => {
      if (value === null || value === undefined || value === '') return null;
      return String(value).trim() || null;
    };

    return {
      asset_house: getTextValue(data.assets_residential),
      asset_shop: getTextValue(data.assets_shop_godown_land),
      asset_gold: getTextValue(data.assets_others), // Map assets_others to gold
      asset_machinery: getTextValue(data.assets_machinery_vehicle),
      asset_stock: getTextValue(data.assets_stock_raw_material),
      liability_qardan: parseDecimal(data.liabilities_borrowing_qardan),
      liability_den: parseDecimal(data.liabilities_goods_credit),
      liability_others: parseDecimal(data.liabilities_others)
    };
  } catch (error) {
    console.error('Error fetching family assets and liabilities:', error);
    return {
      asset_house: null,
      asset_shop: null,
      asset_gold: null,
      asset_machinery: null,
      asset_stock: null,
      liability_qardan: null,
      liability_den: null,
      liability_others: null
    };
  }
};

// Get cover letter form for a case
router.get('/case/:caseId', authenticateToken, authorizeCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;

    const [forms] = await pool.execute(
      'SELECT * FROM cover_letter_forms WHERE case_id = ?',
      [caseId]
    );

    if (forms.length === 0) {
      // If form doesn't exist, fetch applicant and counselor data for auto-population
      const applicantData = await fetchApplicantData(caseId);
      const counsellorData = await fetchCounselorData(caseId);
      const familyFinancialData = await fetchFamilyFinancialData(caseId);
      const familyAssetsLiabilitiesData = await fetchFamilyAssetsAndLiabilities(caseId);
      const personalOccupation = await fetchPersonalOccupation(caseId);
      const financialAssistanceTotals = await fetchFinancialAssistanceTotals(caseId);
      const economicGrowthProfit = await fetchEconomicGrowthProfit(caseId);

      return res.json({ 
        form: null,
        applicantData: applicantData,
        counselorData: counsellorData,
        familyFinancialData: familyFinancialData,
        familyAssetsLiabilitiesData: familyAssetsLiabilitiesData,
        personalOccupationData: personalOccupation,
        financialAssistanceTotals: financialAssistanceTotals,
        economicGrowthProfit: economicGrowthProfit
      });
    }

    const form = forms[0];
    
    // Fetch applicant and counselor data for auto-population if fields are empty
    const applicantData = await fetchApplicantData(caseId);
    const counsellorData = await fetchCounselorData(caseId);
    
    // Fetch family financial data for auto-population if fields are empty
    const familyFinancialData = await fetchFamilyFinancialData(caseId);
    const familyAssetsLiabilitiesData = await fetchFamilyAssetsAndLiabilities(caseId);
    const personalOccupation = await fetchPersonalOccupation(caseId);
    const financialAssistanceTotals = await fetchFinancialAssistanceTotals(caseId);
    const economicGrowthProfit = await fetchEconomicGrowthProfit(caseId);

    // Return individual fields if they exist, otherwise fall back to JSON parsing
    const formData = {
      id: form.id,
      case_id: form.case_id,
      // Individual applicant fields (preferred)
      applicant_name: form.applicant_name || (applicantData?.name || null),
      applicant_jamiat: form.applicant_jamiat || (applicantData?.jamiat || null),
      applicant_jamaat: form.applicant_jamaat || (applicantData?.jamaat || null),
      applicant_age: form.applicant_age || (applicantData?.age || null),
      applicant_contact_number: form.applicant_contact_number || (applicantData?.contact_number || null),
      applicant_case_id: form.applicant_case_id || (applicantData?.case_id || null),
      applicant_its: form.applicant_its || (applicantData?.its || null),
      applicant_photo: form.applicant_photo || (applicantData?.photo || null),
      // Individual counselor fields (preferred)
      counsellor_name: form.counsellor_name || (counsellorData?.name || null),
      counsellor_jamiat: form.counsellor_jamiat || (counsellorData?.jamiat || null),
      counsellor_jamaat: form.counsellor_jamaat || (counsellorData?.jamaat || null),
      counsellor_age: form.counsellor_age || null,
      counsellor_contact_number: form.counsellor_contact_number || (counsellorData?.contact_number || null),
      counsellor_its: form.counsellor_its || (counsellorData?.its || null),
      counsellor_certified: form.counsellor_certified || false,
      counsellor_photo: form.counsellor_photo || (counsellorData?.photo || null),
      // Individual financial fields
      current_personal_income: form.current_personal_income !== null && form.current_personal_income !== undefined 
        ? parseFloat(form.current_personal_income) 
        : (familyFinancialData.current_personal_income !== null ? familyFinancialData.current_personal_income : null),
      current_family_income: form.current_family_income !== null && form.current_family_income !== undefined 
        ? parseFloat(form.current_family_income) 
        : (familyFinancialData.current_family_income !== null ? familyFinancialData.current_family_income : null),
      earning_family_members: form.earning_family_members !== null && form.earning_family_members !== undefined 
        ? parseInt(form.earning_family_members) 
        : (familyFinancialData.earning_family_members !== null ? familyFinancialData.earning_family_members : null),
      dependents: form.dependents !== null && form.dependents !== undefined 
        ? parseInt(form.dependents) 
        : (familyFinancialData.dependents !== null ? familyFinancialData.dependents : null),
      // Individual asset fields (VARCHAR - text values)
      asset_house: form.asset_house !== null && form.asset_house !== undefined 
        ? String(form.asset_house) 
        : (familyAssetsLiabilitiesData.asset_house !== null ? String(familyAssetsLiabilitiesData.asset_house) : null),
      asset_shop: form.asset_shop !== null && form.asset_shop !== undefined 
        ? String(form.asset_shop) 
        : (familyAssetsLiabilitiesData.asset_shop !== null ? String(familyAssetsLiabilitiesData.asset_shop) : null),
      asset_gold: form.asset_gold !== null && form.asset_gold !== undefined 
        ? String(form.asset_gold) 
        : (familyAssetsLiabilitiesData.asset_gold !== null ? String(familyAssetsLiabilitiesData.asset_gold) : null),
      asset_machinery: form.asset_machinery !== null && form.asset_machinery !== undefined 
        ? String(form.asset_machinery) 
        : (familyAssetsLiabilitiesData.asset_machinery !== null ? String(familyAssetsLiabilitiesData.asset_machinery) : null),
      asset_stock: form.asset_stock !== null && form.asset_stock !== undefined 
        ? String(form.asset_stock) 
        : (familyAssetsLiabilitiesData.asset_stock !== null ? String(familyAssetsLiabilitiesData.asset_stock) : null),
      // Individual liability fields
      liability_qardan: form.liability_qardan !== null && form.liability_qardan !== undefined 
        ? parseFloat(form.liability_qardan) 
        : (familyAssetsLiabilitiesData.liability_qardan !== null ? familyAssetsLiabilitiesData.liability_qardan : null),
      liability_den: form.liability_den !== null && form.liability_den !== undefined 
        ? parseFloat(form.liability_den) 
        : (familyAssetsLiabilitiesData.liability_den !== null ? familyAssetsLiabilitiesData.liability_den : null),
      liability_others: form.liability_others !== null && form.liability_others !== undefined 
        ? parseFloat(form.liability_others) 
        : (familyAssetsLiabilitiesData.liability_others !== null ? familyAssetsLiabilitiesData.liability_others : null),
      // Individual business fields
      business_name: form.business_name !== null && form.business_name !== undefined 
        ? String(form.business_name) 
        : null,
      industry_segment: form.industry_segment !== null && form.industry_segment !== undefined 
        ? String(form.industry_segment) 
        : null,
      present_occupation: form.present_occupation !== null && form.present_occupation !== undefined 
        ? String(form.present_occupation) 
        : (personalOccupation !== null ? String(personalOccupation) : null),
      // Individual financial assistance fields
      requested_enayat: form.requested_enayat !== null && form.requested_enayat !== undefined 
        ? parseFloat(form.requested_enayat) 
        : (financialAssistanceTotals.total_enayat !== null ? financialAssistanceTotals.total_enayat : null),
      requested_qardan: form.requested_qardan !== null && form.requested_qardan !== undefined 
        ? parseFloat(form.requested_qardan) 
        : (financialAssistanceTotals.total_qardan !== null ? financialAssistanceTotals.total_qardan : null),
      requested_total: form.requested_total !== null && form.requested_total !== undefined 
        ? parseFloat(form.requested_total) 
        : (form.requested_enayat !== null && form.requested_qardan !== null 
            ? (parseFloat(form.requested_enayat) || 0) + (parseFloat(form.requested_qardan) || 0)
            : (financialAssistanceTotals.total_enayat !== null && financialAssistanceTotals.total_qardan !== null
                ? (financialAssistanceTotals.total_enayat || 0) + (financialAssistanceTotals.total_qardan || 0)
                : null)),
      recommended_enayat: form.recommended_enayat !== null && form.recommended_enayat !== undefined 
        ? parseFloat(form.recommended_enayat) 
        : null,
      recommended_qardan: form.recommended_qardan !== null && form.recommended_qardan !== undefined 
        ? parseFloat(form.recommended_qardan) 
        : null,
      recommended_total: form.recommended_total !== null && form.recommended_total !== undefined 
        ? parseFloat(form.recommended_total) 
        : (form.recommended_enayat !== null && form.recommended_qardan !== null 
            ? (parseFloat(form.recommended_enayat) || 0) + (parseFloat(form.recommended_qardan) || 0)
            : null),
      // Individual projected income fields for applicant
      applicant_projected_income_after_1_year: form.applicant_projected_income_after_1_year !== null && form.applicant_projected_income_after_1_year !== undefined 
        ? parseFloat(form.applicant_projected_income_after_1_year) 
        : (economicGrowthProfit.profit_year1 !== null ? economicGrowthProfit.profit_year1 : null),
      applicant_projected_income_after_2_years: form.applicant_projected_income_after_2_years !== null && form.applicant_projected_income_after_2_years !== undefined 
        ? parseFloat(form.applicant_projected_income_after_2_years) 
        : (economicGrowthProfit.profit_year2 !== null ? economicGrowthProfit.profit_year2 : null),
      applicant_projected_income_after_3_years: form.applicant_projected_income_after_3_years !== null && form.applicant_projected_income_after_3_years !== undefined 
        ? parseFloat(form.applicant_projected_income_after_3_years) 
        : (economicGrowthProfit.profit_year3 !== null ? economicGrowthProfit.profit_year3 : null),
      applicant_projected_income_after_4_years: form.applicant_projected_income_after_4_years !== null && form.applicant_projected_income_after_4_years !== undefined 
        ? parseFloat(form.applicant_projected_income_after_4_years) 
        : (economicGrowthProfit.profit_year4 !== null ? economicGrowthProfit.profit_year4 : null),
      applicant_projected_income_after_5_years: form.applicant_projected_income_after_5_years !== null && form.applicant_projected_income_after_5_years !== undefined 
        ? parseFloat(form.applicant_projected_income_after_5_years) 
        : (economicGrowthProfit.profit_year5 !== null ? economicGrowthProfit.profit_year5 : null),
      // Individual projected income fields for family (user-entered only, no auto-population)
      family_projected_income_after_1_year: form.family_projected_income_after_1_year !== null && form.family_projected_income_after_1_year !== undefined 
        ? parseFloat(form.family_projected_income_after_1_year) 
        : null,
      family_projected_income_after_2_years: form.family_projected_income_after_2_years !== null && form.family_projected_income_after_2_years !== undefined 
        ? parseFloat(form.family_projected_income_after_2_years) 
        : null,
      family_projected_income_after_3_years: form.family_projected_income_after_3_years !== null && form.family_projected_income_after_3_years !== undefined 
        ? parseFloat(form.family_projected_income_after_3_years) 
        : null,
      family_projected_income_after_4_years: form.family_projected_income_after_4_years !== null && form.family_projected_income_after_4_years !== undefined 
        ? parseFloat(form.family_projected_income_after_4_years) 
        : null,
      family_projected_income_after_5_years: form.family_projected_income_after_5_years !== null && form.family_projected_income_after_5_years !== undefined 
        ? parseFloat(form.family_projected_income_after_5_years) 
        : null,
      proposed_upliftment_plan: form.proposed_upliftment_plan || '',
      non_financial_assistance: form.non_financial_assistance || '',
      welfare_department_comments: form.welfare_department_comments || '',
      // Individual approved amounts fields
      approved_enayat: form.approved_enayat !== null && form.approved_enayat !== undefined 
        ? parseFloat(form.approved_enayat) 
        : null,
      approved_qardan: form.approved_qardan !== null && form.approved_qardan !== undefined 
        ? parseFloat(form.approved_qardan) 
        : null,
      approved_qh_months: form.approved_qh_months !== null && form.approved_qh_months !== undefined 
        ? parseInt(form.approved_qh_months) 
        : null,
      // Individual signature fields for Welfare Department
      welfare_department_its: form.welfare_department_its || null,
      welfare_department_name: form.welfare_department_name || null,
      welfare_department_signature_type: form.welfare_department_signature_type || null,
      welfare_department_signature_file_path: form.welfare_department_signature_file_path || null,
      welfare_department_signature_drawing_data: form.welfare_department_signature_drawing_data || null,
      welfare_department_date: form.welfare_department_date ? (form.welfare_department_date instanceof Date ? form.welfare_department_date.toISOString().split('T')[0] : (String(form.welfare_department_date).includes('T') ? String(form.welfare_department_date).split('T')[0] : String(form.welfare_department_date))) : null,
      // Individual signature fields for Zonal In-charge
      zonal_incharge_its: form.zonal_incharge_its || null,
      zonal_incharge_name: form.zonal_incharge_name || null,
      zonal_incharge_signature_type: form.zonal_incharge_signature_type || null,
      zonal_incharge_signature_file_path: form.zonal_incharge_signature_file_path || null,
      zonal_incharge_signature_drawing_data: form.zonal_incharge_signature_drawing_data || null,
      zonal_incharge_date: form.zonal_incharge_date ? (form.zonal_incharge_date instanceof Date ? form.zonal_incharge_date.toISOString().split('T')[0] : (String(form.zonal_incharge_date).includes('T') ? String(form.zonal_incharge_date).split('T')[0] : String(form.zonal_incharge_date))) : null,
      // Individual signature fields for Operations Head
      operations_head_its: form.operations_head_its || null,
      operations_head_name: form.operations_head_name || null,
      operations_head_signature_type: form.operations_head_signature_type || null,
      operations_head_signature_file_path: form.operations_head_signature_file_path || null,
      operations_head_signature_drawing_data: form.operations_head_signature_drawing_data || null,
      operations_head_date: form.operations_head_date ? (form.operations_head_date instanceof Date ? form.operations_head_date.toISOString().split('T')[0] : (String(form.operations_head_date).includes('T') ? String(form.operations_head_date).split('T')[0] : String(form.operations_head_date))) : null,
      is_complete: form.is_complete || false,
      // Only include approval fields if they exist (migration has been run)
      is_approved: form.hasOwnProperty('is_approved') ? (form.is_approved || false) : false,
      approved_at: form.hasOwnProperty('approved_at') ? (form.approved_at || null) : null,
      approved_by: form.hasOwnProperty('approved_by') ? (form.approved_by || null) : null,
      submitted_at: form.submitted_at,
      created_at: form.created_at,
      updated_at: form.updated_at
    };

    res.json({ form: formData });
  } catch (error) {
    console.error('Get cover letter form error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update cover letter form
router.post('/case/:caseId', authenticateToken, authorizeCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.id;
    const {
      // Individual applicant fields
      applicant_name,
      applicant_jamiat,
      applicant_jamaat,
      applicant_age,
      applicant_contact_number,
      applicant_case_id,
      applicant_its,
      applicant_photo,
      // Individual counselor fields
      counsellor_name,
      counsellor_jamiat,
      counsellor_jamaat,
      counsellor_age,
      counsellor_contact_number,
      counsellor_its,
      counsellor_certified,
      counsellor_photo,
      // Individual financial fields
      current_personal_income,
      current_family_income,
      earning_family_members,
      dependents,
      // Individual asset fields
      asset_house,
      asset_shop,
      asset_gold,
      asset_machinery,
      asset_stock,
      // Individual liability fields
      liability_qardan,
      liability_den,
      liability_others,
      // Individual business fields
      business_name,
      industry_segment,
      present_occupation,
      // Individual financial assistance fields
      requested_enayat,
      requested_qardan,
      recommended_enayat,
      recommended_qardan,
      // Individual projected income fields
      applicant_projected_income_after_1_year,
      applicant_projected_income_after_2_years,
      applicant_projected_income_after_3_years,
      applicant_projected_income_after_4_years,
      applicant_projected_income_after_5_years,
      family_projected_income_after_1_year,
      family_projected_income_after_2_years,
      family_projected_income_after_3_years,
      family_projected_income_after_4_years,
      family_projected_income_after_5_years,
      proposed_upliftment_plan,
      non_financial_assistance,
      welfare_department_comments,
      // Individual approved amounts fields
      approved_enayat,
      approved_qardan,
      approved_qh_months,
      // Individual signature fields for Welfare Department
      welfare_department_its,
      welfare_department_name,
      welfare_department_signature_type,
      welfare_department_signature_file_path,
      welfare_department_signature_drawing_data,
      welfare_department_date,
      // Individual signature fields for Zonal In-charge
      zonal_incharge_its,
      zonal_incharge_name,
      zonal_incharge_signature_type,
      zonal_incharge_signature_file_path,
      zonal_incharge_signature_drawing_data,
      zonal_incharge_date,
      // Individual signature fields for Operations Head
      operations_head_its,
      operations_head_name,
      operations_head_signature_type,
      operations_head_signature_file_path,
      operations_head_signature_drawing_data,
      operations_head_date
    } = req.body;

    // Use individual fields directly
    const finalApplicantName = applicant_name || null;
    const finalApplicantJamiat = applicant_jamiat || null;
    const finalApplicantJamaat = applicant_jamaat || null;
    const finalApplicantAge = applicant_age || null;
    const finalApplicantContact = applicant_contact_number || null;
    const finalApplicantCaseId = applicant_case_id || null;
    const finalApplicantIts = applicant_its || null;
    let finalApplicantPhoto = applicant_photo || null;

    const finalCounsellorName = counsellor_name || null;
    const finalCounsellorJamiat = counsellor_jamiat || null;
    const finalCounsellorJamaat = counsellor_jamaat || null;
    const finalCounsellorAge = counsellor_age || null;
    const finalCounsellorContact = counsellor_contact_number || null;
    const finalCounsellorIts = counsellor_its || null;
    const finalCounsellorCertified = counsellor_certified !== undefined ? counsellor_certified : false;
    let finalCounsellorPhoto = counsellor_photo || null;

    // Validate base64 photo format if provided
    const validateBase64Photo = (photo) => {
      if (!photo) return null;
      if (typeof photo !== 'string') return null;
      // Check if it's a valid base64 image string
      if (photo.startsWith('data:image/') || /^[A-Za-z0-9+/=]+$/.test(photo.replace(/^data:image\/[a-z]+;base64,/, ''))) {
        return photo;
      }
      return null;
    };

    finalApplicantPhoto = validateBase64Photo(finalApplicantPhoto);
    finalCounsellorPhoto = validateBase64Photo(finalCounsellorPhoto);

    // Auto-fetch applicant and counsellor data if fields are empty
    if (finalApplicantName === null || finalApplicantJamiat === null || finalApplicantJamaat === null || 
        finalApplicantAge === null || finalApplicantContact === null || finalApplicantCaseId === null || 
        finalApplicantIts === null || finalApplicantPhoto === null) {
      const applicantData = await fetchApplicantData(caseId);
      if (applicantData) {
        if (finalApplicantName === null) finalApplicantName = applicantData.name;
        if (finalApplicantJamiat === null) finalApplicantJamiat = applicantData.jamiat;
        if (finalApplicantJamaat === null) finalApplicantJamaat = applicantData.jamaat;
        if (finalApplicantAge === null) finalApplicantAge = applicantData.age;
        if (finalApplicantContact === null) finalApplicantContact = applicantData.contact_number;
        if (finalApplicantCaseId === null) finalApplicantCaseId = applicantData.case_id;
        if (finalApplicantIts === null) finalApplicantIts = applicantData.its;
        if (finalApplicantPhoto === null) finalApplicantPhoto = applicantData.photo;
      }
    }

    if (finalCounsellorName === null || finalCounsellorJamiat === null || finalCounsellorJamaat === null || 
        finalCounsellorContact === null || finalCounsellorIts === null || finalCounsellorPhoto === null) {
      const counsellorData = await fetchCounselorData(caseId);
      if (counsellorData) {
        if (finalCounsellorName === null) finalCounsellorName = counsellorData.name;
        if (finalCounsellorJamiat === null) finalCounsellorJamiat = counsellorData.jamiat;
        if (finalCounsellorJamaat === null) finalCounsellorJamaat = counsellorData.jamaat;
        if (finalCounsellorContact === null) finalCounsellorContact = counsellorData.contact_number;
        if (finalCounsellorIts === null) finalCounsellorIts = counsellorData.its;
        if (finalCounsellorPhoto === null) finalCounsellorPhoto = counsellorData.photo;
      }
    }

    // Handle financial fields - use provided values or auto-fetch if empty
    let finalCurrentPersonalIncome = current_personal_income !== undefined && current_personal_income !== null && current_personal_income !== '' 
      ? parseFloat(current_personal_income) 
      : null;
    let finalCurrentFamilyIncome = current_family_income !== undefined && current_family_income !== null && current_family_income !== '' 
      ? parseFloat(current_family_income) 
      : null;
    let finalEarningFamilyMembers = earning_family_members !== undefined && earning_family_members !== null && earning_family_members !== '' 
      ? parseInt(earning_family_members) 
      : null;
    let finalDependents = dependents !== undefined && dependents !== null && dependents !== '' 
      ? parseInt(dependents) 
      : null;

    // Handle asset fields - use provided values or auto-fetch if empty (VARCHAR - text values)
    let finalAssetHouse = asset_house !== undefined && asset_house !== null && asset_house !== '' 
      ? String(asset_house).trim() 
      : null;
    let finalAssetShop = asset_shop !== undefined && asset_shop !== null && asset_shop !== '' 
      ? String(asset_shop).trim() 
      : null;
    let finalAssetGold = asset_gold !== undefined && asset_gold !== null && asset_gold !== '' 
      ? String(asset_gold).trim() 
      : null;
    let finalAssetMachinery = asset_machinery !== undefined && asset_machinery !== null && asset_machinery !== '' 
      ? String(asset_machinery).trim() 
      : null;
    let finalAssetStock = asset_stock !== undefined && asset_stock !== null && asset_stock !== '' 
      ? String(asset_stock).trim() 
      : null;

    // Handle liability fields - use provided values or auto-fetch if empty
    let finalLiabilityQardan = liability_qardan !== undefined && liability_qardan !== null && liability_qardan !== '' 
      ? parseFloat(liability_qardan) 
      : null;
    let finalLiabilityDen = liability_den !== undefined && liability_den !== null && liability_den !== '' 
      ? parseFloat(liability_den) 
      : null;
    let finalLiabilityOthers = liability_others !== undefined && liability_others !== null && liability_others !== '' 
      ? parseFloat(liability_others) 
      : null;

    // Auto-fetch if fields are empty
    if (finalCurrentPersonalIncome === null && finalCurrentFamilyIncome === null && 
        finalEarningFamilyMembers === null && finalDependents === null) {
      const familyFinancialData = await fetchFamilyFinancialData(caseId);
      if (finalCurrentPersonalIncome === null) finalCurrentPersonalIncome = familyFinancialData.current_personal_income;
      if (finalCurrentFamilyIncome === null) finalCurrentFamilyIncome = familyFinancialData.current_family_income;
      if (finalEarningFamilyMembers === null) finalEarningFamilyMembers = familyFinancialData.earning_family_members;
      if (finalDependents === null) finalDependents = familyFinancialData.dependents;
    }

    // Auto-fetch assets and liabilities if fields are empty
    if (finalAssetHouse === null && finalAssetShop === null && finalAssetGold === null && 
        finalAssetMachinery === null && finalAssetStock === null && 
        finalLiabilityQardan === null && finalLiabilityDen === null && finalLiabilityOthers === null) {
      const familyAssetsLiabilitiesData = await fetchFamilyAssetsAndLiabilities(caseId);
      if (finalAssetHouse === null) finalAssetHouse = familyAssetsLiabilitiesData.asset_house;
      if (finalAssetShop === null) finalAssetShop = familyAssetsLiabilitiesData.asset_shop;
      if (finalAssetGold === null) finalAssetGold = familyAssetsLiabilitiesData.asset_gold;
      if (finalAssetMachinery === null) finalAssetMachinery = familyAssetsLiabilitiesData.asset_machinery;
      if (finalAssetStock === null) finalAssetStock = familyAssetsLiabilitiesData.asset_stock;
      if (finalLiabilityQardan === null) finalLiabilityQardan = familyAssetsLiabilitiesData.liability_qardan;
      if (finalLiabilityDen === null) finalLiabilityDen = familyAssetsLiabilitiesData.liability_den;
      if (finalLiabilityOthers === null) finalLiabilityOthers = familyAssetsLiabilitiesData.liability_others;
    }

    // Handle business fields - use provided values or auto-fetch if empty
    let finalBusinessName = business_name !== undefined && business_name !== null && business_name !== '' 
      ? String(business_name).trim() 
      : null;
    let finalIndustrySegment = industry_segment !== undefined && industry_segment !== null && industry_segment !== '' 
      ? String(industry_segment).trim() 
      : null;
    let finalPresentOccupation = present_occupation !== undefined && present_occupation !== null && present_occupation !== '' 
      ? String(present_occupation).trim() 
      : null;

    // Auto-fetch present_occupation from personal details if empty
    if (finalPresentOccupation === null) {
      const personalOccupation = await fetchPersonalOccupation(caseId);
      if (personalOccupation !== null) {
        finalPresentOccupation = personalOccupation;
      }
    }

    // Handle financial assistance fields - use provided values or auto-fetch if empty
    let finalRequestedEnayat = requested_enayat !== undefined && requested_enayat !== null && requested_enayat !== '' 
      ? parseFloat(requested_enayat) 
      : null;
    let finalRequestedQardan = requested_qardan !== undefined && requested_qardan !== null && requested_qardan !== '' 
      ? parseFloat(requested_qardan) 
      : null;
    let finalRecommendedEnayat = recommended_enayat !== undefined && recommended_enayat !== null && recommended_enayat !== '' 
      ? parseFloat(recommended_enayat) 
      : null;
    let finalRecommendedQardan = recommended_qardan !== undefined && recommended_qardan !== null && recommended_qardan !== '' 
      ? parseFloat(recommended_qardan) 
      : null;

    // Auto-fetch financial assistance totals if requested fields are empty
    if (finalRequestedEnayat === null || finalRequestedQardan === null) {
      const financialAssistanceTotals = await fetchFinancialAssistanceTotals(caseId);
      if (finalRequestedEnayat === null && financialAssistanceTotals.total_enayat !== null) {
        finalRequestedEnayat = financialAssistanceTotals.total_enayat;
      }
      if (finalRequestedQardan === null && financialAssistanceTotals.total_qardan !== null) {
        finalRequestedQardan = financialAssistanceTotals.total_qardan;
      }
    }

    // Calculate totals
    const finalRequestedTotal = (finalRequestedEnayat !== null || finalRequestedQardan !== null)
      ? (finalRequestedEnayat || 0) + (finalRequestedQardan || 0)
      : null;
    const finalRecommendedTotal = (finalRecommendedEnayat !== null || finalRecommendedQardan !== null)
      ? (finalRecommendedEnayat || 0) + (finalRecommendedQardan || 0)
      : null;

    // Handle projected income fields - use provided values or auto-fetch if empty
    let finalApplicantAfter1Year = applicant_projected_income_after_1_year !== undefined && applicant_projected_income_after_1_year !== null && applicant_projected_income_after_1_year !== '' 
      ? parseFloat(applicant_projected_income_after_1_year) 
      : null;
    let finalApplicantAfter2Years = applicant_projected_income_after_2_years !== undefined && applicant_projected_income_after_2_years !== null && applicant_projected_income_after_2_years !== '' 
      ? parseFloat(applicant_projected_income_after_2_years) 
      : null;
    let finalApplicantAfter3Years = applicant_projected_income_after_3_years !== undefined && applicant_projected_income_after_3_years !== null && applicant_projected_income_after_3_years !== '' 
      ? parseFloat(applicant_projected_income_after_3_years) 
      : null;
    let finalApplicantAfter4Years = applicant_projected_income_after_4_years !== undefined && applicant_projected_income_after_4_years !== null && applicant_projected_income_after_4_years !== '' 
      ? parseFloat(applicant_projected_income_after_4_years) 
      : null;
    let finalApplicantAfter5Years = applicant_projected_income_after_5_years !== undefined && applicant_projected_income_after_5_years !== null && applicant_projected_income_after_5_years !== '' 
      ? parseFloat(applicant_projected_income_after_5_years) 
      : null;

    let finalFamilyAfter1Year = family_projected_income_after_1_year !== undefined && family_projected_income_after_1_year !== null && family_projected_income_after_1_year !== '' 
      ? parseFloat(family_projected_income_after_1_year) 
      : null;
    let finalFamilyAfter2Years = family_projected_income_after_2_years !== undefined && family_projected_income_after_2_years !== null && family_projected_income_after_2_years !== '' 
      ? parseFloat(family_projected_income_after_2_years) 
      : null;
    let finalFamilyAfter3Years = family_projected_income_after_3_years !== undefined && family_projected_income_after_3_years !== null && family_projected_income_after_3_years !== '' 
      ? parseFloat(family_projected_income_after_3_years) 
      : null;
    let finalFamilyAfter4Years = family_projected_income_after_4_years !== undefined && family_projected_income_after_4_years !== null && family_projected_income_after_4_years !== '' 
      ? parseFloat(family_projected_income_after_4_years) 
      : null;
    let finalFamilyAfter5Years = family_projected_income_after_5_years !== undefined && family_projected_income_after_5_years !== null && family_projected_income_after_5_years !== '' 
      ? parseFloat(family_projected_income_after_5_years) 
      : null;

    // Auto-fetch economic growth profit data if any applicant projected income fields are empty
    // Family fields are user-entered only, so we don't check them here
    if (finalApplicantAfter1Year === null || finalApplicantAfter2Years === null || finalApplicantAfter3Years === null || 
        finalApplicantAfter4Years === null || finalApplicantAfter5Years === null) {
      const economicGrowthProfit = await fetchEconomicGrowthProfit(caseId);
      
      // Auto-populate applicant fields if empty
      if (finalApplicantAfter1Year === null && economicGrowthProfit.profit_year1 !== null) finalApplicantAfter1Year = economicGrowthProfit.profit_year1;
      if (finalApplicantAfter2Years === null && economicGrowthProfit.profit_year2 !== null) finalApplicantAfter2Years = economicGrowthProfit.profit_year2;
      if (finalApplicantAfter3Years === null && economicGrowthProfit.profit_year3 !== null) finalApplicantAfter3Years = economicGrowthProfit.profit_year3;
      if (finalApplicantAfter4Years === null && economicGrowthProfit.profit_year4 !== null) finalApplicantAfter4Years = economicGrowthProfit.profit_year4;
      if (finalApplicantAfter5Years === null && economicGrowthProfit.profit_year5 !== null) finalApplicantAfter5Years = economicGrowthProfit.profit_year5;
      
      // Family fields are user-entered only - do NOT auto-populate
    }

    // Handle approved amounts fields
    let finalApprovedEnayat = approved_enayat !== undefined && approved_enayat !== null && approved_enayat !== '' 
      ? parseFloat(approved_enayat) 
      : null;
    let finalApprovedQardan = approved_qardan !== undefined && approved_qardan !== null && approved_qardan !== '' 
      ? parseFloat(approved_qardan) 
      : null;
    let finalApprovedQHMonths = approved_qh_months !== undefined && approved_qh_months !== null && approved_qh_months !== '' 
      ? parseInt(approved_qh_months) 
      : null;

    // Handle signature fields for Welfare Department
    let finalWelfareDepartmentITS = welfare_department_its !== undefined && welfare_department_its !== null && welfare_department_its !== '' 
      ? String(welfare_department_its).trim() 
      : null;
    let finalWelfareDepartmentName = welfare_department_name !== undefined && welfare_department_name !== null && welfare_department_name !== '' 
      ? String(welfare_department_name).trim() 
      : null;
    let finalWelfareDepartmentSignatureType = welfare_department_signature_type !== undefined && welfare_department_signature_type !== null && welfare_department_signature_type !== '' 
      ? String(welfare_department_signature_type).trim() 
      : null;
    let finalWelfareDepartmentSignatureFilePath = welfare_department_signature_file_path !== undefined && welfare_department_signature_file_path !== null && welfare_department_signature_file_path !== '' 
      ? String(welfare_department_signature_file_path).trim() 
      : null;
    let finalWelfareDepartmentSignatureDrawingData = welfare_department_signature_drawing_data !== undefined && welfare_department_signature_drawing_data !== null && welfare_department_signature_drawing_data !== '' 
      ? String(welfare_department_signature_drawing_data).trim() 
      : null;
    let finalWelfareDepartmentDate = welfare_department_date !== undefined && welfare_department_date !== null && welfare_department_date !== '' 
      ? (welfare_department_date.includes('T') ? welfare_department_date.split('T')[0] : welfare_department_date)
      : null;

    // Handle signature fields for Zonal In-charge
    let finalZonalInchargeITS = zonal_incharge_its !== undefined && zonal_incharge_its !== null && zonal_incharge_its !== '' 
      ? String(zonal_incharge_its).trim() 
      : null;
    let finalZonalInchargeName = zonal_incharge_name !== undefined && zonal_incharge_name !== null && zonal_incharge_name !== '' 
      ? String(zonal_incharge_name).trim() 
      : null;
    let finalZonalInchargeSignatureType = zonal_incharge_signature_type !== undefined && zonal_incharge_signature_type !== null && zonal_incharge_signature_type !== '' 
      ? String(zonal_incharge_signature_type).trim() 
      : null;
    let finalZonalInchargeSignatureFilePath = zonal_incharge_signature_file_path !== undefined && zonal_incharge_signature_file_path !== null && zonal_incharge_signature_file_path !== '' 
      ? String(zonal_incharge_signature_file_path).trim() 
      : null;
    let finalZonalInchargeSignatureDrawingData = zonal_incharge_signature_drawing_data !== undefined && zonal_incharge_signature_drawing_data !== null && zonal_incharge_signature_drawing_data !== '' 
      ? String(zonal_incharge_signature_drawing_data).trim() 
      : null;
    let finalZonalInchargeDate = zonal_incharge_date !== undefined && zonal_incharge_date !== null && zonal_incharge_date !== '' 
      ? (zonal_incharge_date.includes('T') ? zonal_incharge_date.split('T')[0] : zonal_incharge_date)
      : null;

    // Handle signature fields for Operations Head
    let finalOperationsHeadITS = operations_head_its !== undefined && operations_head_its !== null && operations_head_its !== '' 
      ? String(operations_head_its).trim() 
      : null;
    let finalOperationsHeadName = operations_head_name !== undefined && operations_head_name !== null && operations_head_name !== '' 
      ? String(operations_head_name).trim() 
      : null;
    let finalOperationsHeadSignatureType = operations_head_signature_type !== undefined && operations_head_signature_type !== null && operations_head_signature_type !== '' 
      ? String(operations_head_signature_type).trim() 
      : null;
    let finalOperationsHeadSignatureFilePath = operations_head_signature_file_path !== undefined && operations_head_signature_file_path !== null && operations_head_signature_file_path !== '' 
      ? String(operations_head_signature_file_path).trim() 
      : null;
    let finalOperationsHeadSignatureDrawingData = operations_head_signature_drawing_data !== undefined && operations_head_signature_drawing_data !== null && operations_head_signature_drawing_data !== '' 
      ? String(operations_head_signature_drawing_data).trim() 
      : null;
    let finalOperationsHeadDate = operations_head_date !== undefined && operations_head_date !== null && operations_head_date !== '' 
      ? (operations_head_date.includes('T') ? operations_head_date.split('T')[0] : operations_head_date)
      : null;

    // Check if form already exists
    let existingForms;
    try {
      // Try to select with is_approved column (if migration has been run)
      const query = 'SELECT id, is_approved FROM cover_letter_forms WHERE case_id = ?';
      existingForms = await pool.execute(query, [caseId]);
    } catch (sqlError) {
      // If is_approved column doesn't exist (migration not run), query without it
      const fallbackQuery = 'SELECT id FROM cover_letter_forms WHERE case_id = ?';
      existingForms = await pool.execute(fallbackQuery, [caseId]);
    }

    // Check permissions based on whether form exists
    const userRole = req.user.role;
    
    if (existingForms[0].length > 0) {
      // Form exists - check update permission
      const canUpdate = await hasPermission(userRole, 'cover_letter_forms', 'update');
      if (!canUpdate && userRole !== 'admin' && userRole !== 'super_admin') {
        return res.status(403).json({ 
          error: 'You do not have permission to update cover letter forms' 
        });
      }
      
      // Check if form is approved and user is not super_admin
      const existingForm = existingForms[0][0];
      // Only check is_approved if the column exists (migration has been run)
      // If is_approved property exists and is true, and user is not super_admin, block edit
      if (existingForm.hasOwnProperty('is_approved') && existingForm.is_approved && req.user.role !== 'super_admin') {
        return res.status(403).json({ 
          error: 'This cover letter has been approved and cannot be edited. Only super admins can edit approved forms.' 
        });
      }
      
      // Update existing form
      const formId = existingForm.id;
      try {
      await pool.execute(
        `UPDATE cover_letter_forms SET
          applicant_name = ?,
          applicant_jamiat = ?,
          applicant_jamaat = ?,
          applicant_age = ?,
          applicant_contact_number = ?,
          applicant_case_id = ?,
          applicant_its = ?,
          applicant_photo = ?,
          counsellor_name = ?,
          counsellor_jamiat = ?,
          counsellor_jamaat = ?,
          counsellor_age = ?,
          counsellor_contact_number = ?,
          counsellor_its = ?,
          counsellor_certified = ?,
          counsellor_photo = ?,
          current_personal_income = ?,
          current_family_income = ?,
          earning_family_members = ?,
          dependents = ?,
          asset_house = ?,
          asset_shop = ?,
          asset_gold = ?,
          asset_machinery = ?,
          asset_stock = ?,
          liability_qardan = ?,
          liability_den = ?,
          liability_others = ?,
          business_name = ?,
          industry_segment = ?,
          present_occupation = ?,
          requested_enayat = ?,
          requested_qardan = ?,
          requested_total = ?,
          recommended_enayat = ?,
          recommended_qardan = ?,
          recommended_total = ?,
          applicant_projected_income_after_1_year = ?,
          applicant_projected_income_after_2_years = ?,
          applicant_projected_income_after_3_years = ?,
          applicant_projected_income_after_4_years = ?,
          applicant_projected_income_after_5_years = ?,
          family_projected_income_after_1_year = ?,
          family_projected_income_after_2_years = ?,
          family_projected_income_after_3_years = ?,
          family_projected_income_after_4_years = ?,
          family_projected_income_after_5_years = ?,
          proposed_upliftment_plan = ?,
          non_financial_assistance = ?,
          welfare_department_comments = ?,
          approved_enayat = ?,
          approved_qardan = ?,
          approved_qh_months = ?,
          welfare_department_its = ?,
          welfare_department_name = ?,
          welfare_department_signature_type = ?,
          welfare_department_signature_file_path = ?,
          welfare_department_signature_drawing_data = ?,
          welfare_department_date = ?,
          zonal_incharge_its = ?,
          zonal_incharge_name = ?,
          zonal_incharge_signature_type = ?,
          zonal_incharge_signature_file_path = ?,
          zonal_incharge_signature_drawing_data = ?,
          zonal_incharge_date = ?,
          operations_head_its = ?,
          operations_head_name = ?,
          operations_head_signature_type = ?,
          operations_head_signature_file_path = ?,
          operations_head_signature_drawing_data = ?,
          operations_head_date = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          finalApplicantName,
          finalApplicantJamiat,
          finalApplicantJamaat,
          finalApplicantAge,
          finalApplicantContact,
          finalApplicantCaseId,
          finalApplicantIts,
          finalApplicantPhoto,
          finalCounsellorName,
          finalCounsellorJamiat,
          finalCounsellorJamaat,
          finalCounsellorAge,
          finalCounsellorContact,
          finalCounsellorIts,
          finalCounsellorCertified,
          finalCounsellorPhoto,
          finalCurrentPersonalIncome,
          finalCurrentFamilyIncome,
          finalEarningFamilyMembers,
          finalDependents,
          finalAssetHouse,
          finalAssetShop,
          finalAssetGold,
          finalAssetMachinery,
          finalAssetStock,
          finalLiabilityQardan,
          finalLiabilityDen,
          finalLiabilityOthers,
          finalBusinessName,
          finalIndustrySegment,
          finalPresentOccupation,
          finalRequestedEnayat,
          finalRequestedQardan,
          finalRequestedTotal,
          finalRecommendedEnayat,
          finalRecommendedQardan,
          finalRecommendedTotal,
          finalApplicantAfter1Year,
          finalApplicantAfter2Years,
          finalApplicantAfter3Years,
          finalApplicantAfter4Years,
          finalApplicantAfter5Years,
          finalFamilyAfter1Year,
          finalFamilyAfter2Years,
          finalFamilyAfter3Years,
          finalFamilyAfter4Years,
          finalFamilyAfter5Years,
          proposed_upliftment_plan || null,
          non_financial_assistance || null,
          welfare_department_comments || null,
          finalApprovedEnayat,
          finalApprovedQardan,
          finalApprovedQHMonths,
          finalWelfareDepartmentITS,
          finalWelfareDepartmentName,
          finalWelfareDepartmentSignatureType,
          finalWelfareDepartmentSignatureFilePath,
          finalWelfareDepartmentSignatureDrawingData,
          finalWelfareDepartmentDate,
          finalZonalInchargeITS,
          finalZonalInchargeName,
          finalZonalInchargeSignatureType,
          finalZonalInchargeSignatureFilePath,
          finalZonalInchargeSignatureDrawingData,
          finalZonalInchargeDate,
          finalOperationsHeadITS,
          finalOperationsHeadName,
          finalOperationsHeadSignatureType,
          finalOperationsHeadSignatureFilePath,
          finalOperationsHeadSignatureDrawingData,
          finalOperationsHeadDate,
          formId
        ]
      );
      } catch (updateError) {
        throw updateError;
      }

      res.json({ 
        message: 'Cover letter form updated successfully',
        formId: formId
      });
    } else {
      // Form doesn't exist - check create permission
      const canCreate = await hasPermission(userRole, 'cover_letter_forms', 'create');
      if (!canCreate && userRole !== 'admin' && userRole !== 'super_admin') {
        return res.status(403).json({ 
          error: 'You do not have permission to create cover letter forms' 
        });
      }
      
      // Create new form
      const [result] = await pool.execute(
        `INSERT INTO cover_letter_forms (
          case_id,
          applicant_name,
          applicant_jamiat,
          applicant_jamaat,
          applicant_age,
          applicant_contact_number,
          applicant_case_id,
          applicant_its,
          applicant_photo,
          counsellor_name,
          counsellor_jamiat,
          counsellor_jamaat,
          counsellor_age,
          counsellor_contact_number,
          counsellor_its,
          counsellor_certified,
          counsellor_photo,
          current_personal_income,
          current_family_income,
          earning_family_members,
          dependents,
          asset_house,
          asset_shop,
          asset_gold,
          asset_machinery,
          asset_stock,
          liability_qardan,
          liability_den,
          liability_others,
          business_name,
          industry_segment,
          present_occupation,
          requested_enayat,
          requested_qardan,
          requested_total,
          recommended_enayat,
          recommended_qardan,
          recommended_total,
          applicant_projected_income_after_1_year,
          applicant_projected_income_after_2_years,
          applicant_projected_income_after_3_years,
          applicant_projected_income_after_4_years,
          applicant_projected_income_after_5_years,
          family_projected_income_after_1_year,
          family_projected_income_after_2_years,
          family_projected_income_after_3_years,
          family_projected_income_after_4_years,
          family_projected_income_after_5_years,
          proposed_upliftment_plan,
          non_financial_assistance,
          welfare_department_comments,
          approved_enayat,
          approved_qardan,
          approved_qh_months,
          welfare_department_its,
          welfare_department_name,
          welfare_department_signature_type,
          welfare_department_signature_file_path,
          welfare_department_signature_drawing_data,
          welfare_department_date,
          zonal_incharge_its,
          zonal_incharge_name,
          zonal_incharge_signature_type,
          zonal_incharge_signature_file_path,
          zonal_incharge_signature_drawing_data,
          zonal_incharge_date,
          operations_head_its,
          operations_head_name,
          operations_head_signature_type,
          operations_head_signature_file_path,
          operations_head_signature_drawing_data,
          operations_head_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          caseId,
          finalApplicantName,
          finalApplicantJamiat,
          finalApplicantJamaat,
          finalApplicantAge,
          finalApplicantContact,
          finalApplicantCaseId,
          finalApplicantIts,
          finalApplicantPhoto,
          finalCounsellorName,
          finalCounsellorJamiat,
          finalCounsellorJamaat,
          finalCounsellorAge,
          finalCounsellorContact,
          finalCounsellorIts,
          finalCounsellorCertified,
          finalCounsellorPhoto,
          finalCurrentPersonalIncome,
          finalCurrentFamilyIncome,
          finalEarningFamilyMembers,
          finalDependents,
          finalAssetHouse,
          finalAssetShop,
          finalAssetGold,
          finalAssetMachinery,
          finalAssetStock,
          finalLiabilityQardan,
          finalLiabilityDen,
          finalLiabilityOthers,
          finalBusinessName,
          finalIndustrySegment,
          finalPresentOccupation,
          finalRequestedEnayat,
          finalRequestedQardan,
          finalRequestedTotal,
          finalRecommendedEnayat,
          finalRecommendedQardan,
          finalRecommendedTotal,
          finalApplicantAfter1Year,
          finalApplicantAfter2Years,
          finalApplicantAfter3Years,
          finalApplicantAfter4Years,
          finalApplicantAfter5Years,
          finalFamilyAfter1Year,
          finalFamilyAfter2Years,
          finalFamilyAfter3Years,
          finalFamilyAfter4Years,
          finalFamilyAfter5Years,
          proposed_upliftment_plan || null,
          non_financial_assistance || null,
          welfare_department_comments || null,
          finalApprovedEnayat,
          finalApprovedQardan,
          finalApprovedQHMonths,
          finalWelfareDepartmentITS,
          finalWelfareDepartmentName,
          finalWelfareDepartmentSignatureType,
          finalWelfareDepartmentSignatureFilePath,
          finalWelfareDepartmentSignatureDrawingData,
          finalWelfareDepartmentDate,
          finalZonalInchargeITS,
          finalZonalInchargeName,
          finalZonalInchargeSignatureType,
          finalZonalInchargeSignatureFilePath,
          finalZonalInchargeSignatureDrawingData,
          finalZonalInchargeDate,
          finalOperationsHeadITS,
          finalOperationsHeadName,
          finalOperationsHeadSignatureType,
          finalOperationsHeadSignatureFilePath,
          finalOperationsHeadSignatureDrawingData,
          finalOperationsHeadDate
        ]
      );

      res.json({ 
        message: 'Cover letter form created successfully',
        formId: result.insertId
      });
    }
  } catch (error) {
    console.error('Create/update cover letter form error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Submit cover letter form and advance workflow
router.put('/:formId/submit', authenticateToken, authorizePermission('cover_letter_forms', 'submit'), async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get form and case details
    const [forms] = await pool.execute(
      `SELECT clf.*, c.id as case_id, c.case_number, c.case_type_id, c.current_workflow_stage_id, c.status
       FROM cover_letter_forms clf
       JOIN cases c ON clf.case_id = c.id
       WHERE clf.id = ?`,
      [formId]
    );

    if (forms.length === 0) {
      return res.status(404).json({ error: 'Cover letter form not found' });
    }

    const form = forms[0];
    const caseId = form.case_id;

    // Check if form is already approved (only super_admin can resubmit approved forms)
    // Note: We allow submission even if case has moved to next stage, as long as form is not approved
    // This allows editing and resubmitting the cover letter until it's approved
    const isFormApproved = form.hasOwnProperty('is_approved') && form.is_approved;
    if (isFormApproved && userRole !== 'super_admin') {
      return res.status(400).json({ error: 'This cover letter has been approved and cannot be resubmitted' });
    }
    
    // Check if case is in Cover Letter stage OR allow if form is not approved (for resubmission)
    const [currentStages] = await pool.execute(
      'SELECT * FROM workflow_stages WHERE id = ? AND is_active = TRUE',
      [form.current_workflow_stage_id]
    );

    // Allow submission if:
    // 1. Case is in cover_letter stage, OR
    // 2. Form is not approved (allows resubmission after case moved to next stage)
    const isCoverLetterStage = currentStages.length > 0 && currentStages[0].stage_key === 'cover_letter';
    const canResubmit = !isFormApproved;
    
    if (!isCoverLetterStage && !canResubmit) {
      return res.status(400).json({ error: 'Case is not in Cover Letter stage and form cannot be resubmitted' });
    }

    // Start transaction
    await pool.query('START TRANSACTION');

    try {
      // Mark form as complete (but don't advance workflow stage - that happens on approval)
      await pool.execute(
        'UPDATE cover_letter_forms SET is_complete = TRUE, submitted_by = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?',
        [userId, formId]
      );

      await pool.query('COMMIT');

      res.json({
        message: 'Cover letter form submitted successfully',
        caseId: caseId
      });
    } catch (error) {
      
      // If it's a data truncation warning, log it but don't fail the transaction
      // MySQL sometimes treats warnings as errors, but the data might still be saved
      if (error.code === 'WARN_DATA_TRUNCATED' || error.errno === 1265) {
        console.warn('Data truncation warning (non-fatal):', error.message);
        // Try to commit anyway - the data was likely saved with truncation
        try {
          await pool.query('COMMIT');
          // If commit succeeds, return success response
          return res.json({
            message: 'Cover letter form submitted successfully (with status truncation)',
            caseId: caseId,
            warning: 'Status value was truncated to fit database column'
          });
        } catch (commitError) {
          // If commit fails, rollback
          await pool.query('ROLLBACK');
          throw error;
        }
      }
      
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Submit cover letter form error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;

