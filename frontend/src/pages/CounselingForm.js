import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation } from 'react-query';
import axios from 'axios';
import { 
  Button, 
  Input, 
  Card, 
  Select, 
  Alert,
  Toast,
  Tabs,
  Badge,
  WorkflowProgress
} from '../components/ui';
import SignaturePad from '../components/SignaturePad';
import WorkflowComments from '../components/WorkflowComments';
import { usePermission } from '../utils/permissionUtils';
import { useAuth } from '../contexts/AuthContext';

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  image: 5 * 1024 * 1024, // 5MB for images
  pdf: 10 * 1024 * 1024,  // 10MB for PDFs
  document: 5 * 1024 * 1024, // 5MB for other documents
  default: 5 * 1024 * 1024   // 5MB default
};

// Helper function to get file size limit based on file type
const getFileSizeLimit = (filename) => {
  const ext = filename.toLowerCase().split('.').pop();
  
  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
    return FILE_SIZE_LIMITS.image;
  } else if (ext === 'pdf') {
    return FILE_SIZE_LIMITS.pdf;
  } else if (['doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'].includes(ext)) {
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

// Helper function to validate file size
const validateFileSize = (file) => {
  const maxSize = getFileSizeLimit(file.name);
  if (file.size > maxSize) {
    return `File "${file.name}" exceeds maximum size. Maximum size is ${formatFileSize(maxSize)}. Your file is ${formatFileSize(file.size)}.`;
  }
  return null;
};

// Helper function to handle numeric-only input (for integers)
const handleIntegerInput = (e) => {
  const char = String.fromCharCode(e.which);
  if (!/[0-9]/.test(char)) {
    e.preventDefault();
  }
};

// Helper function to handle numeric input with decimals (for decimal numbers)
const handleDecimalInput = (e) => {
  const char = String.fromCharCode(e.which);
  const value = e.target.value;
  // Allow: backspace, delete, tab, escape, enter, decimal point
  if (e.which === 8 || e.which === 46 || e.which === 9 || e.which === 27 || e.which === 13 || 
      (e.which === 190 || e.which === 110) && value.indexOf('.') === -1) {
    return;
  }
  // Ensure that it is a number and stop the keypress
  if ((e.shiftKey || (e.which < 48 || e.which > 57)) && (e.which < 96 || e.which > 105)) {
    e.preventDefault();
  }
};

const CounselingForm = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [initialTabSet, setInitialTabSet] = useState(false);
  const [stagePermissions, setStagePermissions] = useState({});
  
  // Check if user has permission to view/add comments
  const { hasPermission: canComment } = usePermission('counseling_forms', 'comment');
  
  // Define workflow steps and tabs (used in multiple places)
  const tabs = [
    { id: 'personal', label: 'Personal Details', icon: '👤' },
    { id: 'family', label: 'Family Details', icon: '👨‍👩‍👧‍👦' },
    { id: 'assessment', label: 'Assessment', icon: '📋' },
    { id: 'financial', label: 'Financial Assistance', icon: '💰' },
    { id: 'growth', label: 'Economic Growth', icon: '📈' },
    { id: 'declaration', label: 'Declaration', icon: '📝' },
    { id: 'attachments', label: 'Attachments', icon: '📎' }
  ];

  // Workflow progress steps
  const workflowSteps = [
    { id: 'personal', number: 1, title: 'Personal Details', date: null },
    { id: 'family', number: 2, title: 'Family Details', date: null },
    { id: 'assessment', number: 3, title: 'Assessment', date: null },
    { id: 'financial', number: 4, title: 'Financial Assistance', date: null },
    { id: 'growth', number: 5, title: 'Economic Growth', date: null },
    { id: 'declaration', number: 6, title: 'Declaration', date: null },
    { id: 'attachments', number: 7, title: 'Attachments', date: null }
  ];
  
  const [qhGroups, setQhGroups] = useState([
    { 
    id: 1, 
    name: 'QH1', 
    year1: '', 
    year2: '', 
    year3: '', 
    year4: '', 
    year5: ''
    },
    { 
      id: 2, 
      name: 'QH2', 
    year1: '', 
    year2: '', 
    year3: '', 
    year4: '', 
      year5: ''
    },
    { 
      id: 3, 
      name: 'QH3', 
      year1: '', 
      year2: '', 
      year3: '', 
      year4: '', 
      year5: ''
    },
    { 
      id: 4, 
      name: 'Local QH', 
      year1: '', 
      year2: '', 
      year3: '', 
      year4: '', 
      year5: ''
    }
  ]);


  // Action Plan state - organized by timeline period
  // Each period starts with at least one fixed action that cannot be removed
  const [actionPlanItems, setActionPlanItems] = useState({
    upto_1st_year_end: [{ id: Date.now() + Math.random(), action_text: '' }],
    '2nd_and_3rd_year': [{ id: Date.now() + Math.random() + 1, action_text: '' }],
    '4th_and_5th_year': [{ id: Date.now() + Math.random() + 2, action_text: '' }]
  });

  // Timeline Assistance state - organized by timeline period
  // Each period starts with at least one fixed action that cannot be removed
  const [timelineAssistanceItems, setTimelineAssistanceItems] = useState({
    immediate: [{ id: Date.now() + Math.random() + 10, purpose_cost: '', enayat: '', qardan: '', months: '' }],
    after_1st_yr: [{ id: Date.now() + Math.random() + 11, purpose_cost: '', enayat: '', qardan: '', months: '' }],
    after_2nd_yr: [{ id: Date.now() + Math.random() + 12, purpose_cost: '', enayat: '', qardan: '', months: '' }],
    after_3rd_yr: [{ id: Date.now() + Math.random() + 13, purpose_cost: '', enayat: '', qardan: '', months: '' }],
    after_4th_yr: [{ id: Date.now() + Math.random() + 14, purpose_cost: '', enayat: '', qardan: '', months: '' }],
    '5th_yr': [{ id: Date.now() + Math.random() + 15, purpose_cost: '', enayat: '', qardan: '', months: '' }]
  });

  // Mentor states for Support needed section
  const [mentorItsInput, setMentorItsInput] = useState('');
  const [mentorLoading, setMentorLoading] = useState(false);
  const [mentorError, setMentorError] = useState('');
  const [trCommitteeItsInput, setTrCommitteeItsInput] = useState('');
  const [trCommitteeLoading, setTrCommitteeLoading] = useState(false);
  const [trCommitteeError, setTrCommitteeError] = useState('');

  // Fetch dropdown data
  const { data: relations } = useQuery(
    'relations',
    () => axios.get('/api/relations').then(res => res.data),
    { staleTime: 5 * 60 * 1000 } // Cache for 5 minutes
  );

  // Fetch existing attachments for the case
  const { data: existingAttachments, error: attachmentsError, isLoading: attachmentsLoading } = useQuery(
    ['attachments', caseId],
    () => axios.get(`/api/attachments/case/${caseId}`).then(res => res.data.attachments),
    { 
      enabled: !!caseId,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      onSuccess: (data) => {
        // Attachments loaded successfully
      },
      onError: (error) => {
        console.error('Error loading attachments:', error);
      }
    }
  );

  const { data: educationLevels } = useQuery(
    'educationLevels',
    () => axios.get('/api/education-levels').then(res => res.data),
    { staleTime: 5 * 60 * 1000 } // Cache for 5 minutes
  );

  const { data: occupations } = useQuery(
    'occupations',
    () => axios.get('/api/occupations').then(res => res.data),
    { staleTime: 5 * 60 * 1000 } // Cache for 5 minutes
  );

  const { register, handleSubmit, control, formState: { errors }, setValue, watch, reset, trigger } = useForm({
    defaultValues: {
      personal_details: {
        its_number: '',
        name: '',
        age: '',
        education: '',
        jamiat: '',
        jamaat: '',
        contact_number: '',
        email: '',
        residential_address: '',
        present_occupation: '',
        occupation_address: '',
        other_info: ''
      },
      family_details: {
        family_members: [],
        other_details: '',
        wellbeing: {
          food: '',
          housing: '',
          education: '',
          health: '',
          deeni: ''
        },
      income_expense: {
        income: {
          business_monthly: '',
          business_yearly: '',
          salary_monthly: '',
          salary_yearly: '',
          home_industry_monthly: '',
          home_industry_yearly: '',
          others_monthly: '',
          others_yearly: ''
        },
        expenses: {
          food_monthly: '',
          food_yearly: '',
          housing_monthly: '',
          housing_yearly: '',
          health_monthly: '',
          health_yearly: '',
          transport_monthly: '',
          transport_yearly: '',
          education_monthly: '',
          education_yearly: '',
          deeni_monthly: '',
          deeni_yearly: '',
          essentials_monthly: '',
          essentials_yearly: '',
          non_essentials_monthly: '',
          non_essentials_yearly: '',
          others_monthly: '',
          others_yearly: '',
          total_monthly: '',
          total_yearly: ''
        },
        surplus_monthly: '',
        surplus_yearly: '',
        deficit_monthly: '',
        deficit_yearly: '',
        scholarship_monthly: '',
        scholarship_yearly: '',
        borrowing_monthly: '',
        borrowing_yearly: ''
      },
        assets_liabilities: {
          assets: {
            residential: '',
            shop_godown_land: '',
            machinery_vehicle: '',
            stock_raw_material: '',
            goods_sold_credit: '',
            others: ''
          },
          liabilities: {
            borrowing_qardan: '',
            goods_credit: '',
            others: '',
            total: ''
          }
        }
      },
      assessment: {
        background: {
          education: '',
          work_experience: '',
          family_business: '',
          skills_knowledge: '',
          counselor_assessment: ''
        },
        proposed_business: {
          present_business_condition: '',
          trade_mark: '',
          online_presence: '',
          digital_marketing: '',
          store_location: '',
          sourcing: '',
          selling: '',
          major_expenses: '',
          goods_purchase: '',
          revenue: '',
          profit_margin: ''
        },
        counselor_assessment: {
          demand_supply: '',
          growth_potential: '',
          competition_strategy: '',
          support_needed: []
        }
      },
      financial_assistance: {
        assistance_required: '',
        timeline: [],
        self_funding: '',
        rahen_available: '',
        repayment_schedule: {
          year1: '',
          year2: '',
          year3: '',
          year4: '',
          year5: ''
        },
        support_needed: [],
        support_industry_knowledge_desc: '',
        support_sourcing_desc: '',
        support_sales_market_desc: '',
        support_internship_desc: '',
        support_mentoring_handholding_desc: '',
        support_bookkeeping_desc: '',
        support_mentors: []
      },
      economic_growth: {
        projections: [],
        // Business Assets fields
        cash_in_hand_last_year: 0,
        cash_in_hand_year1: 0,
        cash_in_hand_year2: 0,
        cash_in_hand_year3: 0,
        cash_in_hand_year4: 0,
        cash_in_hand_year5: 0,
        raw_materials_last_year: 0,
        raw_materials_year1: 0,
        raw_materials_year2: 0,
        raw_materials_year3: 0,
        raw_materials_year4: 0,
        raw_materials_year5: 0,
        sale_on_credit_last_year: 0,
        sale_on_credit_year1: 0,
        sale_on_credit_year2: 0,
        sale_on_credit_year3: 0,
        sale_on_credit_year4: 0,
        sale_on_credit_year5: 0,
        machines_equipment_last_year: 0,
        machines_equipment_year1: 0,
        machines_equipment_year2: 0,
        machines_equipment_year3: 0,
        machines_equipment_year4: 0,
        machines_equipment_year5: 0,
        vehicles_last_year: 0,
        vehicles_year1: 0,
        vehicles_year2: 0,
        vehicles_year3: 0,
        vehicles_year4: 0,
        vehicles_year5: 0,
        shop_godown_last_year: 0,
        shop_godown_year1: 0,
        shop_godown_year2: 0,
        shop_godown_year3: 0,
        shop_godown_year4: 0,
        shop_godown_year5: 0,
        trademark_goodwill_last_year: 0,
        trademark_goodwill_year1: 0,
        trademark_goodwill_year2: 0,
        trademark_goodwill_year3: 0,
        trademark_goodwill_year4: 0,
        trademark_goodwill_year5: 0,
        purchase_on_credit_last_year: 0,
        purchase_on_credit_year1: 0,
        purchase_on_credit_year2: 0,
        purchase_on_credit_year3: 0,
        purchase_on_credit_year4: 0,
        purchase_on_credit_year5: 0,
        // Revenue/Sales fields
        revenue_sales_last_year: 0,
        revenue_sales_year1: 0,
        revenue_sales_year2: 0,
        revenue_sales_year3: 0,
        revenue_sales_year4: 0,
        revenue_sales_year5: 0,
        // Expenses fields
        expenses_raw_material_last_year: 0,
        expenses_raw_material_year1: 0,
        expenses_raw_material_year2: 0,
        expenses_raw_material_year3: 0,
        expenses_raw_material_year4: 0,
        expenses_raw_material_year5: 0,
        expenses_labor_salary_last_year: 0,
        expenses_labor_salary_year1: 0,
        expenses_labor_salary_year2: 0,
        expenses_labor_salary_year3: 0,
        expenses_labor_salary_year4: 0,
        expenses_labor_salary_year5: 0,
        expenses_rent_last_year: 0,
        expenses_rent_year1: 0,
        expenses_rent_year2: 0,
        expenses_rent_year3: 0,
        expenses_rent_year4: 0,
        expenses_rent_year5: 0,
        expenses_overhead_misc_last_year: 0,
        expenses_overhead_misc_year1: 0,
        expenses_overhead_misc_year2: 0,
        expenses_overhead_misc_year3: 0,
        expenses_overhead_misc_year4: 0,
        expenses_overhead_misc_year5: 0,
        expenses_repair_maintenance_depreciation_last_year: 0,
        expenses_repair_maintenance_depreciation_year1: 0,
        expenses_repair_maintenance_depreciation_year2: 0,
        expenses_repair_maintenance_depreciation_year3: 0,
        expenses_repair_maintenance_depreciation_year4: 0,
        expenses_repair_maintenance_depreciation_year5: 0,
        total_expenses_last_year: 0,
        total_expenses_year1: 0,
        total_expenses_year2: 0,
        total_expenses_year3: 0,
        total_expenses_year4: 0,
        total_expenses_year5: 0,
        // Profit fields
        profit_last_year: 0,
        profit_year1: 0,
        profit_year2: 0,
        profit_year3: 0,
        profit_year4: 0,
        profit_year5: 0,
        profit_fund_blocked_last_year: 0,
        profit_fund_blocked_year1: 0,
        profit_fund_blocked_year2: 0,
        profit_fund_blocked_year3: 0,
        profit_fund_blocked_year4: 0,
        profit_fund_blocked_year5: 0,
        profit_qardan_repayment_last_year: 0,
        profit_qardan_repayment_year1: 0,
        profit_qardan_repayment_year2: 0,
        profit_qardan_repayment_year3: 0,
        profit_qardan_repayment_year4: 0,
        profit_qardan_repayment_year5: 0,
        profit_other_income_last_year: 0,
        profit_other_income_year1: 0,
        profit_other_income_year2: 0,
        profit_other_income_year3: 0,
        profit_other_income_year4: 0,
        profit_other_income_year5: 0,
        profit_household_expense_last_year: 0,
        profit_household_expense_year1: 0,
        profit_household_expense_year2: 0,
        profit_household_expense_year3: 0,
        profit_household_expense_year4: 0,
        profit_household_expense_year5: 0,
        // Cash Surplus fields
        cash_surplus_last_year: 0,
        cash_surplus_year1: 0,
        cash_surplus_year2: 0,
        cash_surplus_year3: 0,
        cash_surplus_year4: 0,
        cash_surplus_year5: 0,
        cash_surplus_additional_enayat_last_year: 0,
        cash_surplus_additional_enayat_year1: 0,
        cash_surplus_additional_enayat_year2: 0,
        cash_surplus_additional_enayat_year3: 0,
        cash_surplus_additional_enayat_year4: 0,
        cash_surplus_additional_enayat_year5: 0,
        cash_surplus_additional_qardan_last_year: 0,
        cash_surplus_additional_qardan_year1: 0,
        cash_surplus_additional_qardan_year2: 0,
        cash_surplus_additional_qardan_year3: 0,
        cash_surplus_additional_qardan_year4: 0,
        cash_surplus_additional_qardan_year5: 0
      },
      declaration: {
        applicant_confirmation: '',
        other_comments: '',
        applicant_signature: '',
        counselor_confirmation: '',
        counselor_comments: '',
        counselor_signature: '',
        tr_committee_signature: ''
      },
      attachments: {
        work_place_photo: false,
        work_place_photo_files: [],
        quotation: false,
        quotation_file: null,
        product_brochure: false,
        product_brochure_files: [],
        income_tax_return: false,
        income_tax_return_file: null,
        financial_statements: false,
        financial_statements_file: null,
        cancelled_cheque: false,
        cancelled_cheque_file: null,
        pan_card: false,
        pan_card_file: null,
        aadhar_card: false,
        aadhar_card_file: null,
        other_documents: false,
        other_documents_files: []
      }
    }
  });

  const { fields: familyMembers, append: appendFamilyMember, remove: removeFamilyMember, replace: replaceFamilyMembers } = useFieldArray({
    control,
    name: 'family_details.family_members'
  });

  const { fields: timelineItems, append: appendTimelineItem, remove: removeTimelineItem, replace: replaceTimelineItems } = useFieldArray({
    control,
    name: 'financial_assistance.timeline'
  });

  const { fields: growthProjections, append: appendGrowthProjection, remove: removeGrowthProjection, replace: replaceGrowthProjections } = useFieldArray({
    control,
    name: 'economic_growth.projections'
  });

  // QH Groups management
  const addQhGroup = () => {
    const nextId = Math.max(...qhGroups.map(g => g.id), 0) + 1;
    const nextName = `QH${nextId}`;
    setQhGroups([...qhGroups, { 
      id: nextId, 
      name: nextName, 
      year1: '', 
      year2: '', 
      year3: '', 
      year4: '', 
      year5: '',
    }]);
  };

  const removeQhGroup = (id) => {
    if (qhGroups.length > 1) {
      setQhGroups(qhGroups.filter(group => group.id !== id));
    }
  };

  const updateQhGroupField = (groupId, fieldName, value) => {
    setQhGroups(qhGroups.map(group => 
      group.id === groupId ? { ...group, [fieldName]: value } : group
    ));
  };

  // Enayat Groups management

  // Action Plan management functions
  const addActionPlanItem = (period) => {
    const newId = Date.now() + Math.random(); // Unique ID
    setActionPlanItems(prev => ({
      ...prev,
      [period]: [...prev[period], { id: newId, action_text: '' }]
    }));
  };

  const removeActionPlanItem = (period, index) => {
    // Prevent removing the first action (index 0) - it must always exist
    if (index === 0) {
      return;
    }
    // Only allow removal if there's more than 1 action
    setActionPlanItems(prev => {
      if (prev[period].length <= 1) {
        return prev; // Don't remove if it's the last one
      }
      return {
        ...prev,
        [period]: prev[period].filter((_, i) => i !== index)
      };
    });
  };

  const updateActionPlanItem = (period, index, value) => {
    setActionPlanItems(prev => ({
      ...prev,
      [period]: prev[period].map((item, i) => 
        i === index ? { ...item, action_text: value } : item
      )
    }));
  };

  // Calculate sequential action numbers
  const getActionNumber = (period, index) => {
    const periods = ['upto_1st_year_end', '2nd_and_3rd_year', '4th_and_5th_year'];
    const currentPeriodIndex = periods.indexOf(period);
    let actionNumber = 1;
    
    // Sum actions from previous periods
    for (let i = 0; i < currentPeriodIndex; i++) {
      actionNumber += actionPlanItems[periods[i]].length;
    }
    
    // Add current index (0-based, so +1 for display)
    return actionNumber + index;
  };

  // Timeline Assistance management functions
  const addTimelineAssistanceItem = (period) => {
    const newId = Date.now() + Math.random();
    setTimelineAssistanceItems(prev => ({
      ...prev,
      [period]: [...prev[period], { id: newId, purpose_cost: '', enayat: '', qardan: '', months: '' }]
    }));
  };

  const removeTimelineAssistanceItem = (period, index) => {
    // Prevent removing the first action (index 0) - it must always exist
    if (index === 0) {
      return;
    }
    // Only allow removal if there's more than 1 action
    setTimelineAssistanceItems(prev => {
      if (prev[period].length <= 1) {
        return prev; // Don't remove if it's the last one
      }
      return {
        ...prev,
        [period]: prev[period].filter((_, i) => i !== index)
      };
    });
  };

  const updateTimelineAssistanceItem = (period, index, field, value) => {
    setTimelineAssistanceItems(prev => ({
      ...prev,
      [period]: prev[period].map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  // Calculate sequential timeline assistance numbers
  const getTimelineAssistanceNumber = (period, index) => {
    const periods = ['immediate', 'after_1st_yr', 'after_2nd_yr', 'after_3rd_yr', 'after_4th_yr', '5th_yr'];
    const currentPeriodIndex = periods.indexOf(period);
    let actionNumber = 1;
    
    // Sum actions from previous periods
    for (let i = 0; i < currentPeriodIndex; i++) {
      actionNumber += timelineAssistanceItems[periods[i]].length;
    }
    
    // Add current index (0-based, so +1 for display)
    return actionNumber + index;
  };

  // Calculate total Enayat across all periods
  const calculateTotalEnayat = () => {
    const periods = ['immediate', 'after_1st_yr', 'after_2nd_yr', 'after_3rd_yr', 'after_4th_yr', '5th_yr'];
    let total = 0;
    
    periods.forEach(period => {
      timelineAssistanceItems[period]?.forEach(item => {
        const value = parseFloat(item.enayat) || 0;
        total += value;
      });
    });
    
    return total;
  };

  // Calculate total Qardan across all periods
  const calculateTotalQardan = () => {
    const periods = ['immediate', 'after_1st_yr', 'after_2nd_yr', 'after_3rd_yr', 'after_4th_yr', '5th_yr'];
    let total = 0;
    
    periods.forEach(period => {
      timelineAssistanceItems[period]?.forEach(item => {
        const value = parseFloat(item.qardan) || 0;
        total += value;
      });
    });
    
    return total;
  };




  // Calculation functions
  const calculateTotalIncome = () => {
    const businessMonthly = parseFloat(watch('family_details.income_expense.income.business_monthly')) || 0;
    const salaryMonthly = parseFloat(watch('family_details.income_expense.income.salary_monthly')) || 0;
    const homeIndustryMonthly = parseFloat(watch('family_details.income_expense.income.home_industry_monthly')) || 0;
    const othersMonthly = parseFloat(watch('family_details.income_expense.income.others_monthly')) || 0;
    
    const totalMonthly = businessMonthly + salaryMonthly + homeIndustryMonthly + othersMonthly;
    const totalYearly = totalMonthly * 12;
    
    
    // Update form values without triggering re-render
    setValue('family_details.income_expense.income.total_monthly', totalMonthly, { shouldDirty: false });
    setValue('family_details.income_expense.income.total_yearly', totalYearly, { shouldDirty: false });
    
    calculateSurplusDeficit();
  };

  const calculateTotalExpenses = () => {
    const foodMonthly = parseFloat(watch('family_details.income_expense.expenses.food_monthly')) || 0;
    const housingMonthly = parseFloat(watch('family_details.income_expense.expenses.housing_monthly')) || 0;
    const healthMonthly = parseFloat(watch('family_details.income_expense.expenses.health_monthly')) || 0;
    const educationMonthly = parseFloat(watch('family_details.income_expense.expenses.education_monthly')) || 0;
    const transportMonthly = parseFloat(watch('family_details.income_expense.expenses.transport_monthly')) || 0;
    const deeniMonthly = parseFloat(watch('family_details.income_expense.expenses.deeni_monthly')) || 0;
    const othersMonthly = parseFloat(watch('family_details.income_expense.expenses.others_monthly')) || 0;
    
    const totalMonthly = foodMonthly + housingMonthly + healthMonthly + educationMonthly + 
                        transportMonthly + deeniMonthly + othersMonthly;
    const totalYearly = totalMonthly * 12;
    
    
    // Update form values without triggering re-render
    setValue('family_details.income_expense.expenses.total_monthly', totalMonthly, { shouldDirty: false });
    setValue('family_details.income_expense.expenses.total_yearly', totalYearly, { shouldDirty: false });
    
    calculateSurplusDeficit();
  };

  const calculateSurplusDeficit = () => {
    const totalIncomeMonthly = parseFloat(watch('family_details.income_expense.income.total_monthly')) || 0;
    const totalExpensesMonthly = parseFloat(watch('family_details.income_expense.expenses.total_monthly')) || 0;
    
    const difference = totalIncomeMonthly - totalExpensesMonthly;
    
    if (difference > 0) {
      // Surplus
      setValue('family_details.income_expense.surplus_monthly', difference, { shouldDirty: false });
      setValue('family_details.income_expense.surplus_yearly', difference * 12, { shouldDirty: false });
      setValue('family_details.income_expense.deficit_monthly', 0, { shouldDirty: false });
      setValue('family_details.income_expense.deficit_yearly', 0, { shouldDirty: false });
    } else if (difference < 0) {
      // Deficit
      setValue('family_details.income_expense.deficit_monthly', Math.abs(difference), { shouldDirty: false });
      setValue('family_details.income_expense.deficit_yearly', Math.abs(difference) * 12, { shouldDirty: false });
      setValue('family_details.income_expense.surplus_monthly', 0, { shouldDirty: false });
      setValue('family_details.income_expense.surplus_yearly', 0, { shouldDirty: false });
    } else {
      // Break even
      setValue('family_details.income_expense.surplus_monthly', 0, { shouldDirty: false });
      setValue('family_details.income_expense.surplus_yearly', 0, { shouldDirty: false });
      setValue('family_details.income_expense.deficit_monthly', 0, { shouldDirty: false });
      setValue('family_details.income_expense.deficit_yearly', 0, { shouldDirty: false });
    }
  };

  // Helper function for expense field onChange
  const handleExpenseChange = (fieldName, monthlyValue, yearlyValue) => {
    if (monthlyValue !== undefined) {
      setValue(`family_details.income_expense.expenses.${fieldName}_yearly`, monthlyValue * 12);
    }
    if (yearlyValue !== undefined) {
      setValue(`family_details.income_expense.expenses.${fieldName}_monthly`, yearlyValue / 12);
    }
    calculateTotalExpenses();
  };

  // Calculate total liabilities
  const calculateTotalLiabilities = () => {
    const borrowingQardan = parseFloat(watch('family_details.assets_liabilities.liabilities.borrowing_qardan')) || 0;
    const goodsCredit = parseFloat(watch('family_details.assets_liabilities.liabilities.goods_credit')) || 0;
    const others = parseFloat(watch('family_details.assets_liabilities.liabilities.others')) || 0;
    
    const totalLiabilities = borrowingQardan + goodsCredit + others;
    
    setValue('family_details.assets_liabilities.liabilities.total', totalLiabilities, { shouldDirty: false });
  };

  // Calculate Economic Growth Total Expenses (a+b+c+d+e for each year)
  const calculateEconomicGrowthTotalExpenses = () => {
    // Get all expense values for each year
    const rawMaterialLastYear = parseFloat(watch('economic_growth.expenses_raw_material_last_year')) || 0;
    const rawMaterialYear1 = parseFloat(watch('economic_growth.expenses_raw_material_year1')) || 0;
    const rawMaterialYear2 = parseFloat(watch('economic_growth.expenses_raw_material_year2')) || 0;
    const rawMaterialYear3 = parseFloat(watch('economic_growth.expenses_raw_material_year3')) || 0;
    const rawMaterialYear4 = parseFloat(watch('economic_growth.expenses_raw_material_year4')) || 0;
    const rawMaterialYear5 = parseFloat(watch('economic_growth.expenses_raw_material_year5')) || 0;

    const laborLastYear = parseFloat(watch('economic_growth.expenses_labor_salary_last_year')) || 0;
    const laborYear1 = parseFloat(watch('economic_growth.expenses_labor_salary_year1')) || 0;
    const laborYear2 = parseFloat(watch('economic_growth.expenses_labor_salary_year2')) || 0;
    const laborYear3 = parseFloat(watch('economic_growth.expenses_labor_salary_year3')) || 0;
    const laborYear4 = parseFloat(watch('economic_growth.expenses_labor_salary_year4')) || 0;
    const laborYear5 = parseFloat(watch('economic_growth.expenses_labor_salary_year5')) || 0;

    const rentLastYear = parseFloat(watch('economic_growth.expenses_rent_last_year')) || 0;
    const rentYear1 = parseFloat(watch('economic_growth.expenses_rent_year1')) || 0;
    const rentYear2 = parseFloat(watch('economic_growth.expenses_rent_year2')) || 0;
    const rentYear3 = parseFloat(watch('economic_growth.expenses_rent_year3')) || 0;
    const rentYear4 = parseFloat(watch('economic_growth.expenses_rent_year4')) || 0;
    const rentYear5 = parseFloat(watch('economic_growth.expenses_rent_year5')) || 0;

    const overheadLastYear = parseFloat(watch('economic_growth.expenses_overhead_misc_last_year')) || 0;
    const overheadYear1 = parseFloat(watch('economic_growth.expenses_overhead_misc_year1')) || 0;
    const overheadYear2 = parseFloat(watch('economic_growth.expenses_overhead_misc_year2')) || 0;
    const overheadYear3 = parseFloat(watch('economic_growth.expenses_overhead_misc_year3')) || 0;
    const overheadYear4 = parseFloat(watch('economic_growth.expenses_overhead_misc_year4')) || 0;
    const overheadYear5 = parseFloat(watch('economic_growth.expenses_overhead_misc_year5')) || 0;

    const repairLastYear = parseFloat(watch('economic_growth.expenses_repair_maintenance_depreciation_last_year')) || 0;
    const repairYear1 = parseFloat(watch('economic_growth.expenses_repair_maintenance_depreciation_year1')) || 0;
    const repairYear2 = parseFloat(watch('economic_growth.expenses_repair_maintenance_depreciation_year2')) || 0;
    const repairYear3 = parseFloat(watch('economic_growth.expenses_repair_maintenance_depreciation_year3')) || 0;
    const repairYear4 = parseFloat(watch('economic_growth.expenses_repair_maintenance_depreciation_year4')) || 0;
    const repairYear5 = parseFloat(watch('economic_growth.expenses_repair_maintenance_depreciation_year5')) || 0;

    // Calculate totals for each year (a+b+c+d+e)
    const totalLastYear = rawMaterialLastYear + laborLastYear + rentLastYear + overheadLastYear + repairLastYear;
    const totalYear1 = rawMaterialYear1 + laborYear1 + rentYear1 + overheadYear1 + repairYear1;
    const totalYear2 = rawMaterialYear2 + laborYear2 + rentYear2 + overheadYear2 + repairYear2;
    const totalYear3 = rawMaterialYear3 + laborYear3 + rentYear3 + overheadYear3 + repairYear3;
    const totalYear4 = rawMaterialYear4 + laborYear4 + rentYear4 + overheadYear4 + repairYear4;
    const totalYear5 = rawMaterialYear5 + laborYear5 + rentYear5 + overheadYear5 + repairYear5;

    // Update form values without triggering re-render
    setValue('economic_growth.total_expenses_last_year', totalLastYear, { shouldDirty: false });
    setValue('economic_growth.total_expenses_year1', totalYear1, { shouldDirty: false });
    setValue('economic_growth.total_expenses_year2', totalYear2, { shouldDirty: false });
    setValue('economic_growth.total_expenses_year3', totalYear3, { shouldDirty: false });
    setValue('economic_growth.total_expenses_year4', totalYear4, { shouldDirty: false });
    setValue('economic_growth.total_expenses_year5', totalYear5, { shouldDirty: false });
    
    // Recalculate profit after expenses are calculated
    calculateProfit();
  };

  // Calculate Profit (Revenue - Total Expenses) for each year
  const calculateProfit = () => {
    // Get revenue values
    const revenueLastYear = parseFloat(watch('economic_growth.revenue_sales_last_year')) || 0;
    const revenueYear1 = parseFloat(watch('economic_growth.revenue_sales_year1')) || 0;
    const revenueYear2 = parseFloat(watch('economic_growth.revenue_sales_year2')) || 0;
    const revenueYear3 = parseFloat(watch('economic_growth.revenue_sales_year3')) || 0;
    const revenueYear4 = parseFloat(watch('economic_growth.revenue_sales_year4')) || 0;
    const revenueYear5 = parseFloat(watch('economic_growth.revenue_sales_year5')) || 0;

    // Get total expenses values
    const expensesLastYear = parseFloat(watch('economic_growth.total_expenses_last_year')) || 0;
    const expensesYear1 = parseFloat(watch('economic_growth.total_expenses_year1')) || 0;
    const expensesYear2 = parseFloat(watch('economic_growth.total_expenses_year2')) || 0;
    const expensesYear3 = parseFloat(watch('economic_growth.total_expenses_year3')) || 0;
    const expensesYear4 = parseFloat(watch('economic_growth.total_expenses_year4')) || 0;
    const expensesYear5 = parseFloat(watch('economic_growth.total_expenses_year5')) || 0;

    // Calculate profit for each year (Revenue - Total Expenses)
    const profitLastYear = revenueLastYear - expensesLastYear;
    const profitYear1 = revenueYear1 - expensesYear1;
    const profitYear2 = revenueYear2 - expensesYear2;
    const profitYear3 = revenueYear3 - expensesYear3;
    const profitYear4 = revenueYear4 - expensesYear4;
    const profitYear5 = revenueYear5 - expensesYear5;

    // Update form values without triggering re-render
    setValue('economic_growth.profit_last_year', profitLastYear, { shouldDirty: false });
    setValue('economic_growth.profit_year1', profitYear1, { shouldDirty: false });
    setValue('economic_growth.profit_year2', profitYear2, { shouldDirty: false });
    setValue('economic_growth.profit_year3', profitYear3, { shouldDirty: false });
    setValue('economic_growth.profit_year4', profitYear4, { shouldDirty: false });
    setValue('economic_growth.profit_year5', profitYear5, { shouldDirty: false });
    
    // Recalculate cash surplus after profit is calculated
    calculateCashSurplus();
  };

  // Calculate Cash Surplus (PROFIT - Qardan Repayment - House hold expense + Other Income) for each year
  const calculateCashSurplus = () => {
    // Get profit values
    const profitLastYear = parseFloat(watch('economic_growth.profit_last_year')) || 0;
    const profitYear1 = parseFloat(watch('economic_growth.profit_year1')) || 0;
    const profitYear2 = parseFloat(watch('economic_growth.profit_year2')) || 0;
    const profitYear3 = parseFloat(watch('economic_growth.profit_year3')) || 0;
    const profitYear4 = parseFloat(watch('economic_growth.profit_year4')) || 0;
    const profitYear5 = parseFloat(watch('economic_growth.profit_year5')) || 0;

    // Get Qardan Repayment values
    const qardanRepaymentLastYear = parseFloat(watch('economic_growth.profit_qardan_repayment_last_year')) || 0;
    const qardanRepaymentYear1 = parseFloat(watch('economic_growth.profit_qardan_repayment_year1')) || 0;
    const qardanRepaymentYear2 = parseFloat(watch('economic_growth.profit_qardan_repayment_year2')) || 0;
    const qardanRepaymentYear3 = parseFloat(watch('economic_growth.profit_qardan_repayment_year3')) || 0;
    const qardanRepaymentYear4 = parseFloat(watch('economic_growth.profit_qardan_repayment_year4')) || 0;
    const qardanRepaymentYear5 = parseFloat(watch('economic_growth.profit_qardan_repayment_year5')) || 0;

    // Get House hold expense values
    const householdExpenseLastYear = parseFloat(watch('economic_growth.profit_household_expense_last_year')) || 0;
    const householdExpenseYear1 = parseFloat(watch('economic_growth.profit_household_expense_year1')) || 0;
    const householdExpenseYear2 = parseFloat(watch('economic_growth.profit_household_expense_year2')) || 0;
    const householdExpenseYear3 = parseFloat(watch('economic_growth.profit_household_expense_year3')) || 0;
    const householdExpenseYear4 = parseFloat(watch('economic_growth.profit_household_expense_year4')) || 0;
    const householdExpenseYear5 = parseFloat(watch('economic_growth.profit_household_expense_year5')) || 0;

    // Get Other Income values
    const otherIncomeLastYear = parseFloat(watch('economic_growth.profit_other_income_last_year')) || 0;
    const otherIncomeYear1 = parseFloat(watch('economic_growth.profit_other_income_year1')) || 0;
    const otherIncomeYear2 = parseFloat(watch('economic_growth.profit_other_income_year2')) || 0;
    const otherIncomeYear3 = parseFloat(watch('economic_growth.profit_other_income_year3')) || 0;
    const otherIncomeYear4 = parseFloat(watch('economic_growth.profit_other_income_year4')) || 0;
    const otherIncomeYear5 = parseFloat(watch('economic_growth.profit_other_income_year5')) || 0;

    // Calculate cash surplus for each year: PROFIT - Qardan Repayment - House hold expense + Other Income
    const cashSurplusLastYear = profitLastYear - qardanRepaymentLastYear - householdExpenseLastYear + otherIncomeLastYear;
    const cashSurplusYear1 = profitYear1 - qardanRepaymentYear1 - householdExpenseYear1 + otherIncomeYear1;
    const cashSurplusYear2 = profitYear2 - qardanRepaymentYear2 - householdExpenseYear2 + otherIncomeYear2;
    const cashSurplusYear3 = profitYear3 - qardanRepaymentYear3 - householdExpenseYear3 + otherIncomeYear3;
    const cashSurplusYear4 = profitYear4 - qardanRepaymentYear4 - householdExpenseYear4 + otherIncomeYear4;
    const cashSurplusYear5 = profitYear5 - qardanRepaymentYear5 - householdExpenseYear5 + otherIncomeYear5;

    // Update form values without triggering re-render
    setValue('economic_growth.cash_surplus_last_year', cashSurplusLastYear, { shouldDirty: false });
    setValue('economic_growth.cash_surplus_year1', cashSurplusYear1, { shouldDirty: false });
    setValue('economic_growth.cash_surplus_year2', cashSurplusYear2, { shouldDirty: false });
    setValue('economic_growth.cash_surplus_year3', cashSurplusYear3, { shouldDirty: false });
    setValue('economic_growth.cash_surplus_year4', cashSurplusYear4, { shouldDirty: false });
    setValue('economic_growth.cash_surplus_year5', cashSurplusYear5, { shouldDirty: false });
  };

  // Fetch form data
  const { data: formData, isLoading, isError, error: fetchError, refetch } = useQuery(
    ['counseling-form', caseId],
    () => axios.get(`/api/counseling-forms/case/${caseId}`).then(res => res.data),
    {
      onSuccess: (data) => {
        // Store stage permissions
        if (data.stage_permissions) {
          setStagePermissions(data.stage_permissions);
        }
        
        if (data.form) {
          const form = data.form;
          
          // Set section IDs for completion checking
          if (form.personal_details_id) setValue('personal_details_id', form.personal_details_id);
          if (form.family_details_id) setValue('family_details_id', form.family_details_id);
          if (form.assessment_id) setValue('assessment_id', form.assessment_id);
          if (form.financial_assistance_id) setValue('financial_assistance_id', form.financial_assistance_id);
          if (form.economic_growth_id) setValue('economic_growth_id', form.economic_growth_id);
          if (form.declaration_id) setValue('declaration_id', form.declaration_id);
          if (form.attachments_id) setValue('attachments_id', form.attachments_id);
          
          // Populate form with existing data
          if (form.personal_details) {
            const personalDetails = typeof form.personal_details === 'string' 
              ? JSON.parse(form.personal_details) 
              : form.personal_details;
            setValue('personal_details', personalDetails);
            
            // Auto-populate applicant name, contact, and ITS from applicant info and personal details
            if (form.applicant_info) {
              setValue('declaration.applicant_name', form.applicant_info.full_name || '');
              setValue('declaration.applicant_contact', form.applicant_info.phone || '');
            }
            // Auto-populate applicant ITS from personal details
            if (personalDetails && personalDetails.its_number) {
              setValue('declaration.applicant_its', personalDetails.its_number);
            }
            
            // Auto-populate counselor name, contact, and ITS from counselor info (if not already set)
            if (form.counselor_info) {
              const currentCounselorName = watch('declaration.counselor_name');
              const currentCounselorContact = watch('declaration.counselor_contact');
              
              if (!currentCounselorName && form.counselor_info.name) {
                setValue('declaration.counselor_name', form.counselor_info.name);
              }
              if (!currentCounselorContact && form.counselor_info.contact) {
                setValue('declaration.counselor_contact', form.counselor_info.contact);
              }
              // Auto-populate counselor ITS
              if (form.counselor_info.its_number) {
                setValue('declaration.counselor_its', form.counselor_info.its_number);
              }
            }
          }
          if (form.family_details) {
            const familyDetails = typeof form.family_details === 'string' 
              ? JSON.parse(form.family_details) 
              : form.family_details;
            
            // Migrate old format to new format
            if (familyDetails.family_members) {
              familyDetails.family_members = familyDetails.family_members.map(member => {
                // If it's the old format, convert it
                if (member.age_relation || member.education_occupation) {
                  return {
                    name: member.name || '',
                    age: member.age || '',
                    relation_id: member.relation_id || '',
                    education_id: member.education_id || '',
                    occupation_id: member.occupation_id || '',
                    annual_income: member.annual_income || ''
                  };
                }
                // If it's already the new format, return as is
                return member;
              });
            }
            
            // Migrate old income_expense format to new format (only if needed)
            if (familyDetails.income_expense) {
              const incomeExpense = familyDetails.income_expense;
              
              // Check if income is in old format (has 'business' instead of 'business_monthly')
              if (incomeExpense.income && incomeExpense.income.business && !incomeExpense.income.business_monthly) {
                const income = incomeExpense.income;
                incomeExpense.income = {
                  business_monthly: income.business || '',
                  business_yearly: income.business || '',
                  salary_monthly: income.salary || '',
                  salary_yearly: income.salary || '',
                  home_industry_monthly: income.home_industry || '',
                  home_industry_yearly: income.home_industry || '',
                  others_monthly: income.others || '',
                  others_yearly: income.others || ''
                };
              }
              
              // Check if expenses is in old format (has 'food' instead of 'food_monthly')
              if (incomeExpense.expenses && incomeExpense.expenses.food && !incomeExpense.expenses.food_monthly) {
                const expenses = incomeExpense.expenses;
                incomeExpense.expenses = {
                  food_monthly: expenses.food || '',
                  food_yearly: expenses.food || '',
                  housing_monthly: expenses.housing || '',
                  housing_yearly: expenses.housing || '',
                  health_monthly: expenses.health || '',
                  health_yearly: expenses.health || '',
                  transport_monthly: expenses.transport || '',
                  transport_yearly: expenses.transport || '',
                  education_monthly: expenses.education || '',
                  education_yearly: expenses.education || '',
                  deeni_monthly: expenses.deeni || '',
                  deeni_yearly: expenses.deeni || '',
                  essentials_monthly: expenses.essentials || '',
                  essentials_yearly: expenses.essentials || '',
                  non_essentials_monthly: expenses.non_essentials || '',
                  non_essentials_yearly: expenses.non_essentials || '',
                  others_monthly: expenses.others || '',
                  others_yearly: expenses.others || '',
                  total_monthly: expenses.total || '',
                  total_yearly: expenses.total || ''
                };
              }
              
              // Migrate other fields only if they're in old format
              if (incomeExpense.surplus && !incomeExpense.surplus_monthly) {
                incomeExpense.surplus_monthly = incomeExpense.surplus || '';
                incomeExpense.surplus_yearly = incomeExpense.surplus || '';
              }
              if (incomeExpense.deficit && !incomeExpense.deficit_monthly) {
                incomeExpense.deficit_monthly = incomeExpense.deficit || '';
                incomeExpense.deficit_yearly = incomeExpense.deficit || '';
              }
              if (incomeExpense.scholarship && !incomeExpense.scholarship_monthly) {
                incomeExpense.scholarship_monthly = incomeExpense.scholarship || '';
                incomeExpense.scholarship_yearly = incomeExpense.scholarship || '';
              }
              if (incomeExpense.borrowing && !incomeExpense.borrowing_monthly) {
                incomeExpense.borrowing_monthly = incomeExpense.borrowing || '';
                incomeExpense.borrowing_yearly = incomeExpense.borrowing || '';
              }
            }
            
            setValue('family_details', familyDetails);
            
            // Recalculate totals after setting form data
            setTimeout(() => {
              calculateTotalIncome();
              calculateTotalExpenses();
              calculateTotalLiabilities();
              calculateEconomicGrowthTotalExpenses();
              calculateProfit();
            }, 100);
          }
          if (form.assessment) {
            const assessment = typeof form.assessment === 'string' 
              ? JSON.parse(form.assessment) 
              : form.assessment;
            setValue('assessment', assessment);
          }
          if (form.financial_assistance) {
            const financialAssistance = typeof form.financial_assistance === 'string' 
              ? JSON.parse(form.financial_assistance) 
              : form.financial_assistance;
            setValue('financial_assistance', financialAssistance);
          }
          if (form.economic_growth) {
            const economicGrowth = typeof form.economic_growth === 'string' 
              ? JSON.parse(form.economic_growth) 
              : form.economic_growth;
            setValue('economic_growth', economicGrowth);
            // Recalculate total expenses and profit after setting economic growth data
            setTimeout(() => {
              calculateEconomicGrowthTotalExpenses();
              calculateProfit();
            }, 100);
          }
          if (form.declaration) {
            const declaration = typeof form.declaration === 'string' 
              ? JSON.parse(form.declaration) 
              : form.declaration;
            
            // Format date fields for <input type="date"> (expects yyyy-mm-dd)
            const formatDateForInput = (d) => {
              if (d == null || d === '') return d;
              const s = typeof d === 'string' ? d : (d.toISOString ? d.toISOString() : String(d));
              return s.slice(0, 10);
            };
            declaration.declaration_date = formatDateForInput(declaration.declaration_date);
            declaration.counselor_date = formatDateForInput(declaration.counselor_date);
            declaration.tr_committee_date = formatDateForInput(declaration.tr_committee_date);
            
            // Auto-populate counselor info if not already set
            if (form.counselor_info) {
              if (!declaration.counselor_name && form.counselor_info.name) {
                declaration.counselor_name = form.counselor_info.name;
              }
              if (!declaration.counselor_contact && form.counselor_info.contact) {
                declaration.counselor_contact = form.counselor_info.contact;
              }
              if (!declaration.counselor_its && form.counselor_info.its_number) {
                declaration.counselor_its = form.counselor_info.its_number;
              }
            }
            // Auto-populate applicant ITS if not already set
            if (form.personal_details) {
              const personalDetails = typeof form.personal_details === 'string' 
                ? JSON.parse(form.personal_details) 
                : form.personal_details;
              if (personalDetails && personalDetails.its_number && !declaration.applicant_its) {
                declaration.applicant_its = personalDetails.its_number;
              }
            }
            
            setValue('declaration', declaration);
          } else if (form.counselor_info) {
            // If declaration doesn't exist yet, auto-populate counselor info when it's created
            // This will happen when user navigates to declaration tab
            if (form.counselor_info.name) {
              setValue('declaration.counselor_name', form.counselor_info.name);
            }
            if (form.counselor_info.contact) {
              setValue('declaration.counselor_contact', form.counselor_info.contact);
            }
          }
          if (form.attachments) {
            const attachments = typeof form.attachments === 'string' 
              ? JSON.parse(form.attachments) 
              : form.attachments;
            
            // Only set the boolean flags, don't overwrite the file arrays
            // The file arrays will be set by the existingAttachments useEffect
            setValue('attachments.work_place_photo', attachments.work_place_photo || false);
            setValue('attachments.quotation', attachments.quotation || false);
            setValue('attachments.product_brochure', attachments.product_brochure || false);
            setValue('attachments.income_tax_return', attachments.income_tax_return || false);
            setValue('attachments.financial_statements', attachments.financial_statements || false);
            setValue('attachments.cancelled_cheque', attachments.cancelled_cheque || false);
            setValue('attachments.pan_card', attachments.pan_card || false);
            setValue('attachments.aadhar_card', attachments.aadhar_card || false);
            setValue('attachments.other_documents', attachments.other_documents || false);
          }
        }
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to load counseling form');
      }
    }
  );

  // Effect to initialize field arrays when form data is loaded
  useEffect(() => {
    if (formData?.form) {
      const form = formData.form;
      
      // Initialize family members - ensure first row always has applicant details
      const personalDetails = watch('personal_details') || form.personal_details;
      const applicantInfo = form.applicant_info || {};
      
      // Find "Self" relation ID
      const selfRelation = relations?.find(r => r.name?.toLowerCase() === 'self');
      
      if (form.family_details) {
        const familyDetails = typeof form.family_details === 'string' 
          ? JSON.parse(form.family_details) 
          : form.family_details;
        
        if (familyDetails.family_members && familyDetails.family_members.length > 0) {
          // If family members exist, ensure first row has applicant details
          const updatedMembers = [...familyDetails.family_members];
          // Update first member with applicant details (preserving education, occupation, income if set)
          if (updatedMembers[0]) {
            updatedMembers[0] = {
              ...updatedMembers[0],
              name: applicantInfo.full_name || personalDetails?.its_number || updatedMembers[0].name || '',
              age: personalDetails?.age || updatedMembers[0].age || '',
              relation_id: selfRelation?.id || updatedMembers[0].relation_id || '',
              // Keep education, occupation, and annual_income if they exist
              education_id: updatedMembers[0].education_id || '',
              occupation_id: updatedMembers[0].occupation_id || '',
              annual_income: updatedMembers[0].annual_income || ''
            };
          } else {
            // If first member doesn't exist, create it
            updatedMembers.unshift({
              name: applicantInfo.full_name || personalDetails?.its_number || '',
              age: personalDetails?.age || '',
              relation_id: selfRelation?.id || '',
              education_id: '',
              occupation_id: '',
              annual_income: ''
            });
          }
          replaceFamilyMembers(updatedMembers);
        } else {
          // If no family members exist, initialize with applicant as first member
          const applicantMember = {
            name: applicantInfo.full_name || personalDetails?.its_number || '',
            age: personalDetails?.age || '',
            relation_id: selfRelation?.id || '',
            education_id: '',
            occupation_id: '',
            annual_income: ''
          };
          
          replaceFamilyMembers([applicantMember]);
        }
      } else if (personalDetails || applicantInfo.full_name) {
        // If family_details doesn't exist but we have applicant info, create first row
        const applicantMember = {
          name: applicantInfo.full_name || personalDetails?.its_number || '',
          age: personalDetails?.age || '',
          relation_id: selfRelation?.id || '',
          education_id: '',
          occupation_id: '',
          annual_income: ''
        };
        
        replaceFamilyMembers([applicantMember]);
      }
      
      // Recalculate totals after form data is loaded
      setTimeout(() => {
        calculateTotalIncome();
        calculateTotalExpenses();
        calculateTotalLiabilities();
        calculateEconomicGrowthTotalExpenses();
        calculateProfit();
      }, 200);
      
      // Initialize timeline items - always ensure at least one timeline item is shown by default
      if (form.financial_assistance) {
        const financialAssistance = typeof form.financial_assistance === 'string' 
          ? JSON.parse(form.financial_assistance) 
          : form.financial_assistance;
        
        if (financialAssistance.timeline && financialAssistance.timeline.length > 0) {
          replaceTimelineItems(financialAssistance.timeline);
        } else {
          // Reset to default timeline item if no data or empty array
          replaceTimelineItems([{
            timeline: '',
            purpose: '',
            amount: '',
            support_document: ''
          }]);
        }

        // Initialize timeline assistance items
        if (financialAssistance.timeline_assistance && typeof financialAssistance.timeline_assistance === 'object') {
          // Ensure each period has at least one action
          const periods = ['immediate', 'after_1st_yr', 'after_2nd_yr', 'after_3rd_yr', 'after_4th_yr', '5th_yr'];
          const loadedItems = { ...financialAssistance.timeline_assistance };
          
          periods.forEach(period => {
            if (!loadedItems[period] || loadedItems[period].length === 0) {
              loadedItems[period] = [{ id: Date.now() + Math.random(), purpose_cost: '', enayat: '', qardan: '', months: '' }];
            }
          });
          
          setTimelineAssistanceItems(loadedItems);
        } else {
          // Reset to default timeline assistance items with one fixed action per period
          setTimelineAssistanceItems({
            immediate: [{ id: Date.now() + Math.random() + 10, purpose_cost: '', enayat: '', qardan: '', months: '' }],
            after_1st_yr: [{ id: Date.now() + Math.random() + 11, purpose_cost: '', enayat: '', qardan: '', months: '' }],
            after_2nd_yr: [{ id: Date.now() + Math.random() + 12, purpose_cost: '', enayat: '', qardan: '', months: '' }],
            after_3rd_yr: [{ id: Date.now() + Math.random() + 13, purpose_cost: '', enayat: '', qardan: '', months: '' }],
            after_4th_yr: [{ id: Date.now() + Math.random() + 14, purpose_cost: '', enayat: '', qardan: '', months: '' }],
            '5th_yr': [{ id: Date.now() + Math.random() + 15, purpose_cost: '', enayat: '', qardan: '', months: '' }]
          });
        }

        // Initialize action plan items
        if (financialAssistance.action_plan && Array.isArray(financialAssistance.action_plan) && financialAssistance.action_plan.length > 0) {
          // Group action plan items by timeline_period
          const groupedActions = {
            upto_1st_year_end: [],
            '2nd_and_3rd_year': [],
            '4th_and_5th_year': []
          };

          financialAssistance.action_plan.forEach(item => {
            if (item.timeline_period && groupedActions[item.timeline_period]) {
              groupedActions[item.timeline_period].push({
                id: item.id || Date.now() + Math.random(),
                action_text: item.action_text || ''
              });
            }
          });

          // Ensure each period has at least one action (fixed default)
          const periods = ['upto_1st_year_end', '2nd_and_3rd_year', '4th_and_5th_year'];
          periods.forEach(period => {
            if (groupedActions[period].length === 0) {
              groupedActions[period] = [{ id: Date.now() + Math.random(), action_text: '' }];
            }
          });

          setActionPlanItems(groupedActions);
        } else {
          // Reset to default action plan with one fixed action per period
          setActionPlanItems({
            upto_1st_year_end: [{ id: Date.now() + Math.random(), action_text: '' }],
            '2nd_and_3rd_year': [{ id: Date.now() + Math.random() + 1, action_text: '' }],
            '4th_and_5th_year': [{ id: Date.now() + Math.random() + 2, action_text: '' }]
          });
          // Reset to default timeline assistance items with one fixed action per period
          setTimelineAssistanceItems({
            immediate: [{ id: Date.now() + Math.random() + 10, purpose_cost: '', enayat: '', qardan: '', months: '' }],
            after_1st_yr: [{ id: Date.now() + Math.random() + 11, purpose_cost: '', enayat: '', qardan: '', months: '' }],
            after_2nd_yr: [{ id: Date.now() + Math.random() + 12, purpose_cost: '', enayat: '', qardan: '', months: '' }],
            after_3rd_yr: [{ id: Date.now() + Math.random() + 13, purpose_cost: '', enayat: '', qardan: '', months: '' }],
            after_4th_yr: [{ id: Date.now() + Math.random() + 14, purpose_cost: '', enayat: '', qardan: '', months: '' }],
            '5th_yr': [{ id: Date.now() + Math.random() + 15, purpose_cost: '', enayat: '', qardan: '', months: '' }]
          });
        }
      } else {
        // If no financial assistance data exists, still show default timeline item
        replaceTimelineItems([{
          timeline: '',
          purpose: '',
          amount: '',
          support_document: ''
        }]);
        // Reset to default action plan with one fixed action per period
        setActionPlanItems({
          upto_1st_year_end: [{ id: Date.now() + Math.random(), action_text: '' }],
          '2nd_and_3rd_year': [{ id: Date.now() + Math.random() + 1, action_text: '' }],
          '4th_and_5th_year': [{ id: Date.now() + Math.random() + 2, action_text: '' }]
        });
        // Reset to default timeline assistance items with one fixed action per period
        setTimelineAssistanceItems({
          immediate: [{ id: Date.now() + Math.random() + 10, purpose_cost: '', enayat: '', qardan: '', months: '' }],
          after_1st_yr: [{ id: Date.now() + Math.random() + 11, purpose_cost: '', enayat: '', qardan: '', months: '' }],
          after_2nd_yr: [{ id: Date.now() + Math.random() + 12, purpose_cost: '', enayat: '', qardan: '', months: '' }],
          after_3rd_yr: [{ id: Date.now() + Math.random() + 13, purpose_cost: '', enayat: '', qardan: '', months: '' }],
          after_4th_yr: [{ id: Date.now() + Math.random() + 14, purpose_cost: '', enayat: '', qardan: '', months: '' }],
          '5th_yr': [{ id: Date.now() + Math.random() + 15, purpose_cost: '', enayat: '', qardan: '', months: '' }]
        });
      }

      // Initialize QH groups - always ensure QH1 is shown by default
      if (form.financial_assistance) {
        const financialAssistance = typeof form.financial_assistance === 'string' 
          ? JSON.parse(form.financial_assistance) 
          : form.financial_assistance;
        
        if (financialAssistance.qh_fields && Array.isArray(financialAssistance.qh_fields) && financialAssistance.qh_fields.length > 0) {
          // Ensure all four QH entries exist
          const requiredQhNames = ['QH1', 'QH2', 'QH3', 'Local QH'];
          // Normalize API data: map qh_name to name for consistency
          const loadedQhGroups = financialAssistance.qh_fields.map(group => ({
            ...group,
            name: group.name || group.qh_name || ''
          }));
          
          // Find or create each required QH entry
          requiredQhNames.forEach((qhName, index) => {
            const existingQh = loadedQhGroups.find(g => 
              g.name === qhName || 
              g.name === qhName.replace(' ', '') || 
              (qhName === 'Local QH' && (g.name || '').toLowerCase().includes('local'))
            );
            
            if (!existingQh) {
              // Create missing QH entry
              loadedQhGroups.push({
                id: Math.max(...loadedQhGroups.map(g => g.id), 0) + index + 1,
                name: qhName,
            year1: '', 
            year2: '', 
            year3: '', 
            year4: '', 
            year5: '',
              });
        }
          });

          setQhGroups(loadedQhGroups);
        } else {
          // Reset to default QH groups (all four)
          setQhGroups([
            { 
            id: 1, 
              name: 'QH1', 
            year1: '', 
            year2: '', 
            year3: '', 
            year4: '', 
              year5: ''
            },
            { 
              id: 2, 
              name: 'QH2', 
              year1: '', 
              year2: '', 
              year3: '', 
              year4: '', 
              year5: ''
            },
            { 
              id: 3, 
              name: 'QH3', 
              year1: '', 
              year2: '', 
              year3: '', 
              year4: '', 
              year5: ''
            },
            { 
              id: 4, 
              name: 'Local QH', 
              year1: '', 
              year2: '', 
              year3: '', 
              year4: '', 
              year5: ''
            }
          ]);
        }

      } else {
        // If no financial assistance data exists, still show default QH groups (all four)
        setQhGroups([
          { 
          id: 1, 
          name: 'QH1', 
          year1: '', 
          year2: '', 
          year3: '', 
          year4: '', 
          year5: ''
          },
          { 
            id: 2, 
            name: 'QH2', 
          year1: '', 
          year2: '', 
          year3: '', 
          year4: '', 
            year5: ''
          },
          { 
            id: 3, 
            name: 'QH3', 
            year1: '', 
            year2: '', 
            year3: '', 
            year4: '', 
            year5: ''
          },
          { 
            id: 4, 
            name: 'Local QH', 
            year1: '', 
            year2: '', 
            year3: '', 
            year4: '', 
            year5: ''
          }
        ]);
      }
      
      // Initialize growth projections
      if (form.economic_growth) {
        const economicGrowth = typeof form.economic_growth === 'string' 
          ? JSON.parse(form.economic_growth) 
          : form.economic_growth;
        
        if (economicGrowth.projections && economicGrowth.projections.length > 0) {
          replaceGrowthProjections(economicGrowth.projections);
        }
      }
    }
  }, [formData, replaceFamilyMembers, replaceTimelineItems, replaceGrowthProjections]);

  // Watch for changes in income and expense fields and recalculate totals
  const watchedIncomeFields = watch([
    'family_details.income_expense.income.business_monthly',
    'family_details.income_expense.income.salary_monthly',
    'family_details.income_expense.income.home_industry_monthly',
    'family_details.income_expense.income.others_monthly'
  ]);

  const watchedExpenseFields = watch([
    'family_details.income_expense.expenses.food_monthly',
    'family_details.income_expense.expenses.housing_monthly',
    'family_details.income_expense.expenses.health_monthly',
    'family_details.income_expense.expenses.education_monthly',
    'family_details.income_expense.expenses.transport_monthly',
    'family_details.income_expense.expenses.deeni_monthly',
    'family_details.income_expense.expenses.others_monthly'
  ]);

  const watchedLiabilityFields = watch([
    'family_details.assets_liabilities.liabilities.borrowing_qardan',
    'family_details.assets_liabilities.liabilities.goods_credit',
    'family_details.assets_liabilities.liabilities.others'
  ]);

  // Watch for changes in Economic Growth expense fields
  const watchedEconomicGrowthExpenseFields = watch([
    'economic_growth.expenses_raw_material_last_year',
    'economic_growth.expenses_raw_material_year1',
    'economic_growth.expenses_raw_material_year2',
    'economic_growth.expenses_raw_material_year3',
    'economic_growth.expenses_raw_material_year4',
    'economic_growth.expenses_raw_material_year5',
    'economic_growth.expenses_labor_salary_last_year',
    'economic_growth.expenses_labor_salary_year1',
    'economic_growth.expenses_labor_salary_year2',
    'economic_growth.expenses_labor_salary_year3',
    'economic_growth.expenses_labor_salary_year4',
    'economic_growth.expenses_labor_salary_year5',
    'economic_growth.expenses_rent_last_year',
    'economic_growth.expenses_rent_year1',
    'economic_growth.expenses_rent_year2',
    'economic_growth.expenses_rent_year3',
    'economic_growth.expenses_rent_year4',
    'economic_growth.expenses_rent_year5',
    'economic_growth.expenses_overhead_misc_last_year',
    'economic_growth.expenses_overhead_misc_year1',
    'economic_growth.expenses_overhead_misc_year2',
    'economic_growth.expenses_overhead_misc_year3',
    'economic_growth.expenses_overhead_misc_year4',
    'economic_growth.expenses_overhead_misc_year5',
    'economic_growth.expenses_repair_maintenance_depreciation_last_year',
    'economic_growth.expenses_repair_maintenance_depreciation_year1',
    'economic_growth.expenses_repair_maintenance_depreciation_year2',
    'economic_growth.expenses_repair_maintenance_depreciation_year3',
    'economic_growth.expenses_repair_maintenance_depreciation_year4',
    'economic_growth.expenses_repair_maintenance_depreciation_year5'
  ]);

  // Watch for changes in Revenue and Total Expenses fields for profit calculation
  const watchedRevenueAndExpensesFields = watch([
    'economic_growth.revenue_sales_last_year',
    'economic_growth.revenue_sales_year1',
    'economic_growth.revenue_sales_year2',
    'economic_growth.revenue_sales_year3',
    'economic_growth.revenue_sales_year4',
    'economic_growth.revenue_sales_year5',
    'economic_growth.total_expenses_last_year',
    'economic_growth.total_expenses_year1',
    'economic_growth.total_expenses_year2',
    'economic_growth.total_expenses_year3',
    'economic_growth.total_expenses_year4',
    'economic_growth.total_expenses_year5'
  ]);

  // Auto-calculate Economic Growth Total Expenses when expense fields change
  useEffect(() => {
    // Only calculate if we're on the growth tab and have form data loaded
    if (activeTab === 'growth' && formData?.form) {
      calculateEconomicGrowthTotalExpenses();
    }
  }, [watchedEconomicGrowthExpenseFields, activeTab, formData]);

  // Auto-calculate Profit when revenue or expenses change
  useEffect(() => {
    // Only calculate if we're on the growth tab and have form data loaded
    if (activeTab === 'growth' && formData?.form) {
      calculateProfit();
    }
  }, [watchedRevenueAndExpensesFields, activeTab, formData]);

  // Watch for changes in Profit, Qardan Repayment, Household Expense, and Other Income fields for cash surplus calculation
  const watchedCashSurplusFields = watch([
    'economic_growth.profit_last_year',
    'economic_growth.profit_year1',
    'economic_growth.profit_year2',
    'economic_growth.profit_year3',
    'economic_growth.profit_year4',
    'economic_growth.profit_year5',
    'economic_growth.profit_qardan_repayment_last_year',
    'economic_growth.profit_qardan_repayment_year1',
    'economic_growth.profit_qardan_repayment_year2',
    'economic_growth.profit_qardan_repayment_year3',
    'economic_growth.profit_qardan_repayment_year4',
    'economic_growth.profit_qardan_repayment_year5',
    'economic_growth.profit_household_expense_last_year',
    'economic_growth.profit_household_expense_year1',
    'economic_growth.profit_household_expense_year2',
    'economic_growth.profit_household_expense_year3',
    'economic_growth.profit_household_expense_year4',
    'economic_growth.profit_household_expense_year5',
    'economic_growth.profit_other_income_last_year',
    'economic_growth.profit_other_income_year1',
    'economic_growth.profit_other_income_year2',
    'economic_growth.profit_other_income_year3',
    'economic_growth.profit_other_income_year4',
    'economic_growth.profit_other_income_year5'
  ]);

  // Auto-calculate Cash Surplus when profit, qardan repayment, household expense, or other income change
  useEffect(() => {
    // Only calculate if we're on the growth tab and have form data loaded
    if (activeTab === 'growth' && formData?.form) {
      calculateCashSurplus();
    }
  }, [watchedCashSurplusFields, activeTab, formData]);

  // Auto-populate counselor info when declaration tab is selected
  useEffect(() => {
    if (activeTab === 'declaration' && formData?.form?.counselor_info) {
      const counselorInfo = formData.form.counselor_info;
      const currentCounselorName = watch('declaration.counselor_name');
      const currentCounselorContact = watch('declaration.counselor_contact');
      const currentCounselorIts = watch('declaration.counselor_its');
      
      // Only populate if fields are empty
      if (!currentCounselorName && counselorInfo.name) {
        setValue('declaration.counselor_name', counselorInfo.name);
      }
      if (!currentCounselorContact && counselorInfo.contact) {
        setValue('declaration.counselor_contact', counselorInfo.contact);
      }
      if (!currentCounselorIts && counselorInfo.its_number) {
        setValue('declaration.counselor_its', counselorInfo.its_number);
      }
    }
    // Auto-populate applicant ITS when declaration tab is selected
    if (activeTab === 'declaration' && formData?.form?.personal_details) {
      const personalDetails = typeof formData.form.personal_details === 'string' 
        ? JSON.parse(formData.form.personal_details) 
        : formData.form.personal_details;
      const currentApplicantIts = watch('declaration.applicant_its');
      
      if (!currentApplicantIts && personalDetails?.its_number) {
        setValue('declaration.applicant_its', personalDetails.its_number);
      }
    }
  }, [activeTab, formData, watch, setValue]);

  // Sync TR Committee ITS input with form value
  useEffect(() => {
    const trCommitteeIts = watch('declaration.tr_committee_its');
    if (trCommitteeIts && !trCommitteeItsInput) {
      setTrCommitteeItsInput(trCommitteeIts);
    }
  }, [watch('declaration.tr_committee_its'), trCommitteeItsInput]);

  // Set initial active tab to next incomplete step when form data is loaded
  useEffect(() => {
    if (formData?.form && !initialTabSet) {
      // Wait a bit for all form values to be set
      setTimeout(() => {
        // When opened via Start button (?step=1), always open at Personal Details
        if (searchParams.get('step') === '1') {
          setActiveTab('personal');
          setInitialTabSet(true);
          setSearchParams({});
          return;
        }

        // Check which sections are completed based on form data directly
        const form = formData.form;
        const sectionMapping = {
          'personal': 'personal_details_id',
          'family': 'family_details_id',
          'assessment': 'assessment_id',
          'financial': 'financial_assistance_id',
          'growth': 'economic_growth_id',
          'declaration': 'declaration_id',
          'attachments': 'attachments_id'
        };
        
        // If form is submitted/complete, always start at Personal Details (first step)
        if (form.is_complete) {
          setActiveTab('personal');
          setInitialTabSet(true);
          return;
        }
        
        // Find the first incomplete step
        for (const step of workflowSteps) {
          const sectionKey = sectionMapping[step.id];
          if (!form[sectionKey]) {
            setActiveTab(step.id);
            setInitialTabSet(true);
            return;
          }
        }
        
        // If all steps are completed (but form is not marked complete), stay on the last step
        setActiveTab(workflowSteps[workflowSteps.length - 1].id);
        setInitialTabSet(true);
      }, 300);
    }
  }, [formData, initialTabSet, workflowSteps, searchParams, setSearchParams]);

  // Load existing attachments when they're fetched
  useEffect(() => {
    if (existingAttachments && existingAttachments.length > 0) {
      
      // Group attachments by stage
      const attachmentsByStage = existingAttachments.reduce((acc, attachment) => {
        if (!acc[attachment.stage]) {
          acc[attachment.stage] = [];
        }
        acc[attachment.stage].push(attachment);
        return acc;
      }, {});

      // Update form with existing attachments
      Object.keys(attachmentsByStage).forEach(stage => {
        const stageAttachments = attachmentsByStage[stage];
        
        // Create file objects for display
        const fileObjects = stageAttachments.map(attachment => ({
          name: attachment.file_name,
          size: attachment.file_size,
          type: attachment.file_type,
          path: attachment.file_path,
          id: attachment.id
        }));

        // Set the appropriate field based on stage
        switch (stage) {
          case 'work_place_photo':
            setValue('attachments.work_place_photo_files', fileObjects);
            setValue('attachments.work_place_photo', true);
            break;
          case 'quotation':
            setValue('attachments.quotation_file', fileObjects[0] || null);
            setValue('attachments.quotation', true);
            break;
          case 'product_brochure':
            setValue('attachments.product_brochure_files', fileObjects);
            setValue('attachments.product_brochure', true);
            break;
          case 'income_tax_return':
            setValue('attachments.income_tax_return_file', fileObjects[0] || null);
            setValue('attachments.income_tax_return', true);
            break;
          case 'financial_statements':
            setValue('attachments.financial_statements_file', fileObjects[0] || null);
            setValue('attachments.financial_statements', true);
            break;
          case 'cancelled_cheque':
            setValue('attachments.cancelled_cheque_file', fileObjects[0] || null);
            setValue('attachments.cancelled_cheque', true);
            break;
          case 'pan_card':
            setValue('attachments.pan_card_file', fileObjects[0] || null);
            setValue('attachments.pan_card', true);
            break;
          case 'aadhar_card':
            setValue('attachments.aadhar_card_file', fileObjects[0] || null);
            setValue('attachments.aadhar_card', true);
            break;
          case 'other_documents':
            setValue('attachments.other_documents_files', fileObjects);
            setValue('attachments.other_documents', true);
            break;
        }
      });
    }
  }, [existingAttachments, setValue, formData]);

  // Removed automatic calculation useEffect hooks to prevent infinite loops
  // Calculations will be triggered manually when user changes input values

  // Save form section mutation
  const saveSectionMutation = useMutation(
    ({ section, data }) => axios.put(`/api/counseling-forms/${formData?.form?.id}/section/${section}`, data),
    {
      onSuccess: () => {
        setSuccess('Section saved successfully!');
        setError('');
        setTimeout(() => setSuccess(''), 3000);
      },
      onError: (error) => {
        // Check if it's a permission error (403)
        if (error.response?.status === 403 || error.response?.data?.error?.includes('permission')) {
          setError('You do not have permission');
        } else {
          setError(error.response?.data?.error || error.response?.data?.message || 'Failed to save section');
        }
        setSuccess('');
      }
    }
  );

  // Complete form mutation
  // Check if user has permission to complete forms
  // Super admin always has this permission
  const { hasPermission: canCompleteFormCheck, loading: permissionLoading } = usePermission('counseling_forms', 'complete');
  const canCompleteForm = user?.role === 'super_admin' ? true : canCompleteFormCheck;

  const completeFormMutation = useMutation(
    () => axios.put(`/api/counseling-forms/${formData?.form?.id}/complete`),
    {
      onSuccess: () => {
        setSuccess('Form completed successfully and submitted to welfare department!');
        setError('');
        setTimeout(() => {
          navigate('/cases');
        }, 2000);
      },
      onError: (error) => {
        setError(error.response?.data?.message || 'Failed to complete form');
        setSuccess('');
      }
    }
  );

  // Map section names to stage keys for permission checking
  const sectionToStageMap = {
    'personal_details': 'personal',
    'family_details': 'family',
    'assessment': 'assessment',
    'financial_assistance': 'financial',
    'economic_growth': 'growth',
    'declaration': 'declaration',
    'attachments': 'attachments'
  };

  // Map section names to their validation field paths
  const sectionToValidationPath = {
    'personal_details': 'personal_details',
    'family_details': 'family_details',
    'assessment': 'assessment',
    'financial_assistance': 'financial_assistance',
    'economic_growth': 'economic_growth',
    'declaration': 'declaration',
    'attachments': 'attachments'
  };

  const handleSectionSaveAsDraft = async (sectionName, sectionData) => {
    // Check permission before attempting to save
    const stageKey = sectionToStageMap[sectionName];
    if (stageKey && !canUpdateSection(stageKey)) {
      setError('You do not have permission');
      return;
    }

    try {
      if (sectionName === 'attachments') {
        await handleAttachmentsSave(sectionData, existingAttachments);
      } else {
        await saveSectionMutation.mutateAsync({ section: sectionName, data: sectionData });
      }
      
      setSuccess('Draft saved successfully!');
      // Stay on current section - no navigation
    } catch (error) {
      console.error('Error saving draft:', error);
      setError(error.response?.data?.error || 'Failed to save draft');
    }
  };

  const handleSectionSave = async (sectionName, sectionData) => {
    // Check permission before attempting to save
    const stageKey = sectionToStageMap[sectionName];
    if (stageKey && !canUpdateSection(stageKey)) {
      setError('You do not have permission');
      return;
    }

    // Validate all required fields in the current section
    const validationPath = sectionToValidationPath[sectionName];
    if (validationPath) {
      const isValid = await trigger(validationPath);
      if (!isValid) {
        setError('Please fill in all required fields before saving');
        // Scroll to first error
        const firstError = Object.keys(errors).find(key => key.startsWith(validationPath));
        if (firstError) {
          const element = document.querySelector(`[name="${firstError}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        return;
      }
    }

    try {
      if (sectionName === 'attachments') {
        await handleAttachmentsSave(sectionData, existingAttachments);
      } else {
        await saveSectionMutation.mutateAsync({ section: sectionName, data: sectionData });
      }
      
      // After successful save, navigate to next incomplete step
      // Refetch form data to update section IDs
      const refetchedData = await refetch();
      
      // Get the next incomplete step based on updated form data
      if (refetchedData?.data?.form) {
        const form = refetchedData.data.form;
        
        const sectionIdMapping = {
          'personal': 'personal_details_id',
          'family': 'family_details_id',
          'assessment': 'assessment_id',
          'financial': 'financial_assistance_id',
          'growth': 'economic_growth_id',
          'declaration': 'declaration_id',
          'attachments': 'attachments_id'
        };
        
        // Find the first incomplete step
        let nextStep = null;
        for (const step of workflowSteps) {
          const sectionKey = sectionIdMapping[step.id];
          if (!form[sectionKey]) {
            nextStep = step.id;
            break;
          }
        }
        
        // If all steps are completed, stay on the last step
        if (!nextStep) {
          nextStep = workflowSteps[workflowSteps.length - 1].id;
        }
        
        if (nextStep && nextStep !== activeTab) {
          setActiveTab(nextStep);
          // Scroll to top of the form
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    } catch (error) {
      console.error('Error saving section:', error);
    }
  };

  const handleAttachmentsSave = async (attachmentsData, existingAttachmentsData) => {
    try {
      setUploadingFiles(true);
      const caseId = formData?.form?.case_id;
      if (!caseId) {
        throw new Error('Case ID not found');
      }


      // Upload files for each attachment type
      const uploadPromises = [];
      const deletePromises = [];

      // Function to queue files for deletion
      const queueFilesForDeletion = (stageName, currentFiles, existingFiles) => {
        // Ensure currentFiles is an array for consistency
        const currentFilesArray = Array.isArray(currentFiles) ? currentFiles : (currentFiles ? [currentFiles] : []);
        const currentFileIds = new Set(currentFilesArray.filter(f => f.id).map(f => f.id));

        const filesRemoved = existingFiles.filter(
          existingFile => existingFile.stage === stageName && !currentFileIds.has(existingFile.id)
        );

               filesRemoved.forEach(file => {
                 deletePromises.push(
                   axios.delete(`/api/attachments/${file.id}`)
                     .then(() => {
                       // File deleted successfully
                     })
                     .catch(error => {
                       console.error(`Failed to delete file: ${file.file_name}`, error);
                       // Don't throw the error, just log it so other operations can continue
                     })
                 );
               });
      };

      // Queue files for deletion for each attachment stage
      if (existingAttachmentsData && existingAttachmentsData.length > 0) {
        queueFilesForDeletion('work_place_photo', attachmentsData.work_place_photo_files, existingAttachmentsData);
        queueFilesForDeletion('quotation', attachmentsData.quotation_file, existingAttachmentsData);
        queueFilesForDeletion('product_brochure', attachmentsData.product_brochure_files, existingAttachmentsData);
        queueFilesForDeletion('income_tax_return', attachmentsData.income_tax_return_file, existingAttachmentsData);
        queueFilesForDeletion('financial_statements', attachmentsData.financial_statements_file, existingAttachmentsData);
        queueFilesForDeletion('cancelled_cheque', attachmentsData.cancelled_cheque_file, existingAttachmentsData);
        queueFilesForDeletion('pan_card', attachmentsData.pan_card_file, existingAttachmentsData);
        queueFilesForDeletion('aadhar_card', attachmentsData.aadhar_card_file, existingAttachmentsData);
        queueFilesForDeletion('other_documents', attachmentsData.other_documents_files, existingAttachmentsData);
      }

      // Handle work place photo files (multiple)
      if (attachmentsData.work_place_photo_files?.length > 0) {
        // Only upload new files (files without id property)
        const newFiles = attachmentsData.work_place_photo_files.filter(file => !file.id);
        if (newFiles.length > 0) {
          const formData_work = new FormData();
          newFiles.forEach(file => {
            formData_work.append('files', file);
          });
          formData_work.append('stage', 'work_place_photo');
          uploadPromises.push(
            axios.post(`/api/attachments/upload-multiple/${caseId}`, formData_work, {
              headers: { 'Content-Type': 'multipart/form-data' }
            })
          );
        }
      }

      // Handle quotation file (single)
      if (attachmentsData.quotation_file && !attachmentsData.quotation_file.id) {
        const formData_quotation = new FormData();
        formData_quotation.append('file', attachmentsData.quotation_file);
        formData_quotation.append('stage', 'quotation');
        uploadPromises.push(
          axios.post(`/api/attachments/upload/${caseId}`, formData_quotation, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
        );
      }

      // Handle product brochure files (multiple)
      if (attachmentsData.product_brochure_files?.length > 0) {
        // Only upload new files (files without id property)
        const newFiles = attachmentsData.product_brochure_files.filter(file => !file.id);
        if (newFiles.length > 0) {
          const formData_brochure = new FormData();
          newFiles.forEach(file => {
            formData_brochure.append('files', file);
          });
          formData_brochure.append('stage', 'product_brochure');
          uploadPromises.push(
            axios.post(`/api/attachments/upload-multiple/${caseId}`, formData_brochure, {
              headers: { 'Content-Type': 'multipart/form-data' }
            })
          );
        }
      }

      // Handle income tax return file (single)
      if (attachmentsData.income_tax_return_file && !attachmentsData.income_tax_return_file.id) {
        const formData_tax = new FormData();
        formData_tax.append('file', attachmentsData.income_tax_return_file);
        formData_tax.append('stage', 'income_tax_return');
        uploadPromises.push(
          axios.post(`/api/attachments/upload/${caseId}`, formData_tax, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
        );
      }

      // Handle financial statements file (single)
      if (attachmentsData.financial_statements_file && !attachmentsData.financial_statements_file.id) {
        const formData_financial = new FormData();
        formData_financial.append('file', attachmentsData.financial_statements_file);
        formData_financial.append('stage', 'financial_statements');
        uploadPromises.push(
          axios.post(`/api/attachments/upload/${caseId}`, formData_financial, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
        );
      }

      // Handle cancelled cheque file (single)
      if (attachmentsData.cancelled_cheque_file && !attachmentsData.cancelled_cheque_file.id) {
        const formData_cheque = new FormData();
        formData_cheque.append('file', attachmentsData.cancelled_cheque_file);
        formData_cheque.append('stage', 'cancelled_cheque');
        uploadPromises.push(
          axios.post(`/api/attachments/upload/${caseId}`, formData_cheque, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
        );
      }

      // Handle PAN card file (single)
      if (attachmentsData.pan_card_file && !attachmentsData.pan_card_file.id) {
        const formData_pan = new FormData();
        formData_pan.append('file', attachmentsData.pan_card_file);
        formData_pan.append('stage', 'pan_card');
        uploadPromises.push(
          axios.post(`/api/attachments/upload/${caseId}`, formData_pan, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
        );
      }

      // Handle Aadhar card file (single)
      if (attachmentsData.aadhar_card_file && !attachmentsData.aadhar_card_file.id) {
        const formData_aadhar = new FormData();
        formData_aadhar.append('file', attachmentsData.aadhar_card_file);
        formData_aadhar.append('stage', 'aadhar_card');
        uploadPromises.push(
          axios.post(`/api/attachments/upload/${caseId}`, formData_aadhar, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
        );
      }

      // Handle other documents files (multiple)
        if (attachmentsData.other_documents_files?.length > 0) {
          // Only upload new files (files without id property)
          const newFiles = attachmentsData.other_documents_files.filter(file => !file.id);
        if (newFiles.length > 0) {
          const formData_other = new FormData();
          newFiles.forEach(file => {
            formData_other.append('files', file);
          });
          formData_other.append('stage', 'other_documents');
          uploadPromises.push(
            axios.post(`/api/attachments/upload-multiple/${caseId}`, formData_other, {
              headers: { 'Content-Type': 'multipart/form-data' }
            })
          );
        }
      }

      // Wait for all file operations (uploads and deletions) to complete
      const allPromises = [...uploadPromises, ...deletePromises];
      
      if (allPromises.length > 0) {
        await Promise.all(allPromises);
        
        // Show success message if files were deleted
        if (deletePromises.length > 0) {
          setSuccess(`${deletePromises.length} file(s) deleted successfully`);
        }
      }

      // Now save the attachment flags (checkboxes)
      const attachmentFlags = {
        work_place_photo: attachmentsData.work_place_photo,
        quotation: attachmentsData.quotation,
        product_brochure: attachmentsData.product_brochure,
        income_tax_return: attachmentsData.income_tax_return,
        financial_statements: attachmentsData.financial_statements,
        cancelled_cheque: attachmentsData.cancelled_cheque,
        pan_card: attachmentsData.pan_card,
        aadhar_card: attachmentsData.aadhar_card,
        other_documents: attachmentsData.other_documents
      };

      await saveSectionMutation.mutateAsync({ section: 'attachments', data: attachmentFlags });
      
      // Note: The attachments query will automatically refresh when the component re-renders
      // or when the user navigates back to the page, showing the updated file list
    } catch (error) {
      console.error('Error saving attachments:', error);
      throw error;
    } finally {
      setUploadingFiles(false);
    }
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      // Save all sections
      const sections = [
        'personal_details',
        'family_details', 
        'assessment',
        'financial_assistance',
        'economic_growth',
        'declaration',
        'attachments'
      ];

      for (const section of sections) {
        if (data[section]) {
          await handleSectionSave(section, data[section]);
        }
      }

      setSuccess('All sections saved successfully!');
    } catch (error) {
      setError('Failed to save form data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteForm = async () => {
    if (window.confirm('Are you sure you want to complete this form and submit it to the welfare department? This action cannot be undone.')) {
      await completeFormMutation.mutateAsync();
    }
  };

  // Calculate current step based on active tab
  const getCurrentStep = () => {
    const stepIndex = workflowSteps.findIndex(step => step.id === activeTab);
    return stepIndex >= 0 ? stepIndex : 0;
  };

  // Map section names to stage keys
  const sectionToStageKey = {
    'personal': 'personal',
    'family': 'family',
    'assessment': 'assessment',
    'financial': 'financial',
    'growth': 'growth',
    'declaration': 'declaration',
    'attachments': 'attachments'
  };

  // Check if user can update a specific section
  const canUpdateSection = (sectionKey) => {
    // Super admin always has full access
    if (user?.role === 'super_admin') {
      return true;
    }
    
    // Check if form is complete and not rejected - if so, disable editing
    // Forms can only be edited after completion if they were rejected (welfare_rejected status)
    if (formData?.form?.is_complete && formData?.form?.case_status !== 'welfare_rejected') {
      return false;
    }
    
    const stageKey = sectionToStageKey[sectionKey];
    if (!stageKey) return true; // Default to true if section not found
    
    const perm = stagePermissions[stageKey];
    if (!perm) return true; // Default to true if permission not found
    
    return perm.can_update === true;
  };

  // Check if a section is completed based on form data
  const isSectionCompleted = (sectionId) => {
    const formData = watch();
    
    // Use the section IDs from the backend to determine completion (consistent with backend logic)
    switch (sectionId) {
      case 'personal':
        // If personal_details_id exists, the section is completed
        return formData.personal_details_id || (formData.personal_details?.its_number && formData.personal_details?.age && formData.personal_details?.present_occupation);
      case 'family':
        // If family_details_id exists, the section is completed
        return formData.family_details_id || (formData.family_details?.family_members?.length > 0 && 
               formData.family_details?.family_members?.some(member => 
                 member.name && member.age && member.relation_id
               ));
      case 'assessment':
        // If assessment_id exists, the section is completed
        return formData.assessment_id || formData.assessment?.background?.education;
      case 'financial':
        // If financial_assistance_id exists, the section is completed
        return formData.financial_assistance_id || formData.financial_assistance?.assistance_required;
      case 'growth':
        // If economic_growth_id exists, the section is completed
        return formData.economic_growth_id || (formData.economic_growth && (
          formData.economic_growth.projections?.length > 0 ||
          formData.economic_growth.revenue_sales_last_year > 0 ||
          formData.economic_growth.revenue_sales_year1 > 0 ||
          formData.economic_growth.cash_in_hand_last_year > 0 ||
          formData.economic_growth.cash_in_hand_year1 > 0 ||
          formData.economic_growth.raw_materials_last_year > 0 ||
          formData.economic_growth.raw_materials_year1 > 0 ||
          formData.economic_growth.sale_on_credit_last_year > 0 ||
          formData.economic_growth.sale_on_credit_year1 > 0 ||
          formData.economic_growth.machines_equipment_last_year > 0 ||
          formData.economic_growth.machines_equipment_year1 > 0 ||
          formData.economic_growth.vehicles_last_year > 0 ||
          formData.economic_growth.vehicles_year1 > 0 ||
          formData.economic_growth.shop_godown_last_year > 0 ||
          formData.economic_growth.shop_godown_year1 > 0 ||
          formData.economic_growth.trademark_goodwill_last_year > 0 ||
          formData.economic_growth.trademark_goodwill_year1 > 0 ||
          formData.economic_growth.purchase_on_credit_last_year > 0 ||
          formData.economic_growth.purchase_on_credit_year1 > 0 ||
          formData.economic_growth.expenses_raw_material_last_year > 0 ||
          formData.economic_growth.expenses_raw_material_year1 > 0
        ));
      case 'declaration':
        // If declaration_id exists, the section is completed regardless of content
        return formData.declaration_id || (formData.declaration?.applicant_confirmation && formData.declaration.applicant_confirmation.trim() !== '');
      case 'attachments':
        // If attachments_id exists, the section is completed
        return formData.attachments_id || formData.attachments?.work_place_photo;
      default:
        return false;
    }
  };

  // Calculate completed steps
  const getCompletedSteps = () => {
    return workflowSteps.filter(step => isSectionCompleted(step.id)).length;
  };

  // Get next incomplete workflow step
  const getNextIncompleteStep = () => {
    for (const step of workflowSteps) {
      if (!isSectionCompleted(step.id)) {
        return step.id;
      }
    }
    // If all steps are completed, return the last step
    return workflowSteps[workflowSteps.length - 1].id;
  };

  // Handle progress bar step click
  const handleStepClick = (stepId, stepIndex) => {
    setActiveTab(stepId);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <Alert severity="error" className="mb-4" onClose={() => window.location.reload()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Error Loading Counseling Form</h3>
                <p className="text-sm mt-1">
                  {fetchError?.response?.data?.error || 'Failed to load counseling form data'}
                </p>
                <p className="text-xs mt-2 text-gray-600">
                  Error details: {fetchError?.message || 'Unknown error'}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="ml-4"
              >
                Retry
              </Button>
            </div>
          </Alert>
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => navigate('/cases')}
              className="mt-4"
            >
              Back to Cases
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Application and Assessment Form (Program: SHND)</h1>
            <p className="text-gray-600">Case ID: {caseId}</p>
          </div>
          <div className="flex space-x-3">
            <Badge variant={formData?.form?.is_complete ? 'success' : 'warning'}>
              {formData?.form?.is_complete ? 'Completed' : 'In Progress'}
            </Badge>
            {!formData?.form?.is_complete && canCompleteForm && (
              <Button
                onClick={handleCompleteForm}
                variant="primary"
                disabled={completeFormMutation.isLoading || getCompletedSteps() !== workflowSteps.length}
              >
                Mark as Complete & Submit
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && <Alert severity="error" className="mb-4" onClose={() => setError('')}>{error}</Alert>}
      
      {/* Toast Notification */}
      {success && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <Toast 
            severity="success" 
            onClose={() => setSuccess('')}
            autoClose={true}
            duration={4000}
          >
            {success}
          </Toast>
        </div>
      )}

      {/* Workflow Progress Bar */}
      <div className="mb-6">
        <WorkflowProgress
          steps={workflowSteps}
          currentStep={getCurrentStep()}
          completedSteps={workflowSteps.filter(step => isSectionCompleted(step.id)).map(step => step.id)}
          onStepClick={handleStepClick}
        />
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Progress: {getCompletedSteps()} of {workflowSteps.length} sections completed
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="mb-6"
        />

        <Card className="p-6">
          {/* Personal Details Section */}
          {activeTab === 'personal' && (
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">1. Personal Details</h3>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="ITS Number"
                  required
                  {...register('personal_details.its_number', { required: 'ITS number is required' })}
                  error={errors.personal_details?.its_number?.message}
                  disabled={true}
                  className="bg-gray-100"
                />
                <Input
                  label="Name"
                  required
                  {...register('personal_details.name', { required: 'Name is required' })}
                  error={errors.personal_details?.name?.message}
                  disabled={true}
                  className="bg-gray-100"
                />
                <Input
                  label="Age"
                  type="number"
                  required
                  {...register('personal_details.age', { required: 'Age is required' })}
                  error={errors.personal_details?.age?.message}
                  disabled={true}
                  className="bg-gray-100"
                />
                <Input
                  label="Education"
                  {...register('personal_details.education')}
                  error={errors.personal_details?.education?.message}
                  disabled={!canUpdateSection('personal')}
                  className={!canUpdateSection('personal') ? 'bg-gray-100' : ''}
                />
                <Input
                  label="Jamiat"
                  required
                  {...register('personal_details.jamiat', { required: 'Jamiat is required' })}
                  error={errors.personal_details?.jamiat?.message}
                  disabled={true}
                  className="bg-gray-100"
                />
                <Input
                  label="Jamaat"
                  required
                  {...register('personal_details.jamaat', { required: 'Jamaat is required' })}
                  error={errors.personal_details?.jamaat?.message}
                  disabled={true}
                  className="bg-gray-100"
                />
                <Input
                  label="Contact Number"
                  required
                  {...register('personal_details.contact_number', { required: 'Contact number is required' })}
                  error={errors.personal_details?.contact_number?.message}
                  disabled={!canUpdateSection('personal')}
                  className={!canUpdateSection('personal') ? 'bg-gray-100' : ''}
                />
                <Input
                  label="Email ID"
                  type="email"
                  required
                  {...register('personal_details.email', { required: 'Email ID is required' })}
                  error={errors.personal_details?.email?.message}
                  disabled={!canUpdateSection('personal')}
                  className={!canUpdateSection('personal') ? 'bg-gray-100' : ''}
                />
              </div>

              <div className="space-y-4">
                <Input
                  label="Residential Address"
                  required
                  {...register('personal_details.residential_address', { required: 'Residential address is required' })}
                  error={errors.personal_details?.residential_address?.message}
                  disabled={!canUpdateSection('personal')}
                  className={!canUpdateSection('personal') ? 'bg-gray-100' : ''}
                />
                <Input
                  label="Present Occupation"
                  required
                  {...register('personal_details.present_occupation', { required: 'Present occupation is required' })}
                  error={errors.personal_details?.present_occupation?.message}
                  disabled={!canUpdateSection('personal')}
                  className={!canUpdateSection('personal') ? 'bg-gray-100' : ''}
                />
                <Input
                  label="Occupation Address"
                  required
                  {...register('personal_details.occupation_address', { required: 'Occupation address is required' })}
                  error={errors.personal_details?.occupation_address?.message}
                  disabled={!canUpdateSection('personal')}
                  className={!canUpdateSection('personal') ? 'bg-gray-100' : ''}
                />
                <Input
                  label="Other Relevant Information"
                  required
                  {...register('personal_details.other_info', { required: 'Other relevant information is required' })}
                  error={errors.personal_details?.other_info?.message}
                  disabled={!canUpdateSection('personal')}
                  className={!canUpdateSection('personal') ? 'bg-gray-100' : ''}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSectionSaveAsDraft('personal_details', watch('personal_details'))}
                  disabled={saveSectionMutation.isLoading || !canUpdateSection('personal')}
                  className={!canUpdateSection('personal') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {saveSectionMutation.isLoading ? 'Saving...' : 'Save as Draft'}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSectionSave('personal_details', watch('personal_details'))}
                  disabled={saveSectionMutation.isLoading || !canUpdateSection('personal')}
                  className={!canUpdateSection('personal') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {saveSectionMutation.isLoading ? 'Saving...' : 'Save and Next'}
                </Button>
              </div>
            </div>
          )}

          {/* Workflow Comments for Personal Details */}
          {activeTab === 'personal' && canComment && (
            <WorkflowComments caseId={caseId} workflowStep="personal" />
          )}

          {/* Family Details Section */}
          {activeTab === 'family' && (
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">2. Family Details</h3>
                </div>
              </div>

              {/* 2.1 Family Members */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-gray-900">2.1 Family Members</h4>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => appendFamilyMember({ name: '', age: '', relation_id: '', education_id: '', occupation_id: '', annual_income: '' })}
                    disabled={!canUpdateSection('family')}
                    className={!canUpdateSection('family') ? 'opacity-50 cursor-not-allowed' : ''}
                  >
                    Add Member
                  </Button>
                </div>

                <div className="space-y-4">
                  {familyMembers.map((member, index) => {
                    const isFirstRow = index === 0;
                    const isReadOnly = !canUpdateSection('family');
                    const shouldDisableFirstRow = isFirstRow || isReadOnly;
                    
                    return (
                    <Card key={member.id} className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                        <Input
                          label="Name"
                          required
                          {...register(`family_details.family_members.${index}.name`, { required: 'Name is required' })}
                          error={errors.family_details?.family_members?.[index]?.name?.message}
                          disabled={shouldDisableFirstRow}
                          className={shouldDisableFirstRow ? 'bg-gray-100' : ''}
                        />
                        <Input
                          label="Age"
                          type="number"
                          required
                          onKeyPress={handleIntegerInput}
                          {...register(`family_details.family_members.${index}.age`, { required: 'Age is required' })}
                          error={errors.family_details?.family_members?.[index]?.age?.message}
                          disabled={shouldDisableFirstRow}
                          className={shouldDisableFirstRow ? 'bg-gray-100' : ''}
                        />
                        <Select
                          label="Relation"
                          required
                          {...register(`family_details.family_members.${index}.relation_id`, { required: 'Relation is required' })}
                          error={errors.family_details?.family_members?.[index]?.relation_id?.message}
                          disabled={shouldDisableFirstRow}
                          className={shouldDisableFirstRow ? 'bg-gray-100' : ''}
                        >
                          <option value="">Select Relation</option>
                          {relations?.map((relation) => (
                            <option key={relation.id} value={relation.id}>
                              {relation.name}
                            </option>
                          ))}
                        </Select>
                        <Select
                          label="Education"
                          required
                          {...register(`family_details.family_members.${index}.education_id`, { required: 'Education is required' })}
                          error={errors.family_details?.family_members?.[index]?.education_id?.message}
                          disabled={!canUpdateSection('family')}
                          className={!canUpdateSection('family') ? 'bg-gray-100' : ''}
                        >
                          <option value="">Select Education</option>
                          {educationLevels?.map((education) => (
                            <option key={education.id} value={education.id}>
                              {education.name}
                            </option>
                          ))}
                        </Select>
                        <Select
                          label="Occupation"
                          required
                          {...register(`family_details.family_members.${index}.occupation_id`, { required: 'Occupation is required' })}
                          error={errors.family_details?.family_members?.[index]?.occupation_id?.message}
                          disabled={!canUpdateSection('family')}
                          className={!canUpdateSection('family') ? 'bg-gray-100' : ''}
                        >
                          <option value="">Select Occupation</option>
                          {occupations?.map((occupation) => (
                            <option key={occupation.id} value={occupation.id}>
                              {occupation.name}
                            </option>
                          ))}
                        </Select>
                        <div className="flex items-end space-x-2">
                          <Input
                            label="Annual Income"
                            type="number"
                            required
                            onKeyPress={handleDecimalInput}
                            {...register(`family_details.family_members.${index}.annual_income`, { required: 'Annual income is required' })}
                            error={errors.family_details?.family_members?.[index]?.annual_income?.message}
                            disabled={!canUpdateSection('family')}
                            className={!canUpdateSection('family') ? 'bg-gray-100' : ''}
                          />
                          {isFirstRow ? null : (
                            <Button
                              type="button"
                              variant="danger"
                              onClick={() => removeFamilyMember(index)}
                              disabled={!canUpdateSection('family')}
                              className={!canUpdateSection('family') ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                  })}
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Other Details
                  </label>
                  <textarea
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 ${
                      errors.family_details?.other_details?.message 
                        ? 'border-red-300 focus:ring-red-500' 
                        : 'border-gray-300 hover:border-gray-400'
                    } ${
                      !canUpdateSection('family') 
                        ? 'bg-gray-100 cursor-not-allowed' 
                        : 'bg-white'
                    }`}
                    {...register('family_details.other_details')}
                    disabled={!canUpdateSection('family')}
                  />
                  {errors.family_details?.other_details?.message && (
                    <p className="mt-1 text-sm text-red-600">{errors.family_details.other_details.message}</p>
                  )}
                </div>
              </div>

              {/* 2.2 Present Family Wellbeing/Lifestyle */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">2.2 Present Family Wellbeing/Lifestyle</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Food"
                    required
                    {...register('family_details.wellbeing.food', { required: 'Food is required' })}
                    error={errors.family_details?.wellbeing?.food?.message}
                    disabled={!canUpdateSection('family')}
                    className={!canUpdateSection('family') ? 'bg-gray-100' : ''}
                  />
                  <Input
                    label="Housing"
                    required
                    {...register('family_details.wellbeing.housing', { required: 'Housing is required' })}
                    error={errors.family_details?.wellbeing?.housing?.message}
                    disabled={!canUpdateSection('family')}
                    className={!canUpdateSection('family') ? 'bg-gray-100' : ''}
                  />
                  <Input
                    label="Education"
                    required
                    {...register('family_details.wellbeing.education', { required: 'Education is required' })}
                    error={errors.family_details?.wellbeing?.education?.message}
                    disabled={!canUpdateSection('family')}
                    className={!canUpdateSection('family') ? 'bg-gray-100' : ''}
                  />
                  <Input
                    label="Health"
                    required
                    {...register('family_details.wellbeing.health', { required: 'Health is required' })}
                    error={errors.family_details?.wellbeing?.health?.message}
                    disabled={!canUpdateSection('family')}
                    className={!canUpdateSection('family') ? 'bg-gray-100' : ''}
                  />
                  <Input
                    label="Deeni"
                    required
                    {...register('family_details.wellbeing.deeni', { required: 'Deeni is required' })}
                    error={errors.family_details?.wellbeing?.deeni?.message}
                    disabled={!canUpdateSection('family')}
                    className={!canUpdateSection('family') ? 'bg-gray-100' : ''}
                  />
                </div>
              </div>

              {/* 2.3 Present Household Income and Expense */}
              <div>
                <h4 className="text-lg font-bold italic text-blue-600 mb-4">2.3. Present Household Income and Expense</h4>
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-green-100">
                        <th className="border border-gray-300 px-3 py-2 text-center text-blue-600 font-bold text-sm">Sr No</th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-blue-600 font-bold text-sm">Category and Subcategory</th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-blue-600 font-bold text-sm">Monthly</th>
                        <th className="border border-gray-300 px-3 py-2 text-center text-blue-600 font-bold text-sm">Yearly</th>
                      </tr>
                    </thead>
                    <tbody className="bg-green-50">
                      {/* INCOME Section */}
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 text-center font-bold text-blue-600">1</td>
                        <td className="border border-gray-300 px-3 py-2 font-bold text-blue-600">INCOME</td>
                        <td className="border border-gray-300 px-3 py-2"></td>
                        <td className="border border-gray-300 px-3 py-2"></td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 text-center">a</td>
                        <td className="border border-gray-300 px-3 py-2">Business <span className="text-red-500">*</span></td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className={`w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${!canUpdateSection('family') ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                            {...register('family_details.income_expense.income.business_monthly', { required: 'Business monthly income is required', valueAsNumber: true })}
                            disabled={!canUpdateSection('family')}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              if (!canUpdateSection('family')) return;
                              const monthlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.income.business_yearly', monthlyValue * 12);
                              calculateTotalIncome();
                            }}
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.income.business_yearly', { required: 'Business yearly income is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              const yearlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.income.business_monthly', yearlyValue / 12);
                              calculateTotalIncome();
                            }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 text-center">b</td>
                        <td className="border border-gray-300 px-3 py-2">Salary <span className="text-red-500">*</span></td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.income.salary_monthly', { required: 'Salary monthly income is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              const monthlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.income.salary_yearly', monthlyValue * 12);
                              calculateTotalIncome();
                            }}
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.income.salary_yearly', { required: 'Salary yearly income is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              const yearlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.income.salary_monthly', yearlyValue / 12);
                              calculateTotalIncome();
                            }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 text-center">c</td>
                        <td className="border border-gray-300 px-3 py-2">Home Industry <span className="text-red-500">*</span></td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.income.home_industry_monthly', { required: 'Home industry monthly income is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              const monthlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.income.home_industry_yearly', monthlyValue * 12);
                              calculateTotalIncome();
                            }}
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.income.home_industry_yearly', { required: 'Home industry yearly income is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              const yearlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.income.home_industry_monthly', yearlyValue / 12);
                              calculateTotalIncome();
                            }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 text-center">d</td>
                        <td className="border border-gray-300 px-3 py-2">Others</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.income.others_monthly', { valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              const monthlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.income.others_yearly', monthlyValue * 12);
                              calculateTotalIncome();
                            }}
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.income.others_yearly', { valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              const yearlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.income.others_monthly', yearlyValue / 12);
                              calculateTotalIncome();
                            }}
                          />
                        </td>
                      </tr>
                      <tr className="bg-gray-100">
                        <td className="border border-gray-300 px-3 py-2 text-center"></td>
                        <td className="border border-gray-300 px-3 py-2 font-bold">Total Income</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-gray-100"
                            {...register('family_details.income_expense.income.total_monthly')}
                            readOnly
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-gray-100"
                            {...register('family_details.income_expense.income.total_yearly')}
                            readOnly
                          />
                        </td>
                      </tr>

                      {/* EXPENSES Section */}
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 text-center font-bold text-blue-600">2</td>
                        <td className="border border-gray-300 px-3 py-2 font-bold text-blue-600">EXPENSES</td>
                        <td className="border border-gray-300 px-3 py-2"></td>
                        <td className="border border-gray-300 px-3 py-2"></td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 text-center">a</td>
                        <td className="border border-gray-300 px-3 py-2">Food: Groceries plus others <span className="text-red-500">*</span></td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.expenses.food_monthly', { required: 'Food monthly expense is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              const monthlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.expenses.food_yearly', monthlyValue * 12);
                              calculateTotalExpenses();
                            }}
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.expenses.food_yearly', { required: 'Food yearly expense is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              const yearlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.expenses.food_monthly', yearlyValue / 12);
                              calculateTotalExpenses();
                            }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 text-center">b</td>
                        <td className="border border-gray-300 px-3 py-2">Housing: Rent, Maintenance, Electricity etc. <span className="text-red-500">*</span></td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.expenses.housing_monthly', { required: 'Housing monthly expense is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              const monthlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.expenses.housing_yearly', monthlyValue * 12);
                              calculateTotalExpenses();
                            }}
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.expenses.housing_yearly', { required: 'Housing yearly expense is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              const yearlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.expenses.housing_monthly', yearlyValue / 12);
                              calculateTotalExpenses();
                            }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 text-center">c</td>
                        <td className="border border-gray-300 px-3 py-2">Health: Doctor, Medicine <span className="text-red-500">*</span></td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.expenses.health_monthly', { required: 'Health monthly expense is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => handleExpenseChange('health', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.expenses.health_yearly', { required: 'Health yearly expense is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => handleExpenseChange('health', undefined, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 text-center">d</td>
                        <td className="border border-gray-300 px-3 py-2">Education: Fees, Books, Tuitions, etc. <span className="text-red-500">*</span></td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.expenses.education_monthly', { required: 'Education monthly expense is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => handleExpenseChange('education', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.expenses.education_yearly', { required: 'Education yearly expense is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => handleExpenseChange('education', undefined, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 text-center">e</td>
                        <td className="border border-gray-300 px-3 py-2">Others Essentials: Clothes, Personal Care, Local Transport, Misc etc. <span className="text-red-500">*</span></td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.expenses.transport_monthly', { required: 'Others Essentials monthly expense is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => handleExpenseChange('transport', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.expenses.transport_yearly', { required: 'Others Essentials yearly expense is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => handleExpenseChange('transport', undefined, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 text-center">f</td>
                        <td className="border border-gray-300 px-3 py-2">Deeni: Sabeel, Wajebaat, Niyaaz etc. <span className="text-red-500">*</span></td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.expenses.deeni_monthly', { required: 'Deeni monthly expense is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => handleExpenseChange('deeni', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.expenses.deeni_yearly', { required: 'Deeni yearly expense is required', valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => handleExpenseChange('deeni', undefined, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 text-center">g</td>
                        <td className="border border-gray-300 px-3 py-2">Others</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.expenses.others_monthly', { valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => handleExpenseChange('others', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.expenses.others_yearly', { valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => handleExpenseChange('others', undefined, parseFloat(e.target.value) || 0)}
                          />
                        </td>
                      </tr>
                      <tr className="bg-gray-100">
                        <td className="border border-gray-300 px-3 py-2 text-center"></td>
                        <td className="border border-gray-300 px-3 py-2 font-bold">Total Family Expenses</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-gray-100"
                            {...register('family_details.income_expense.expenses.total_monthly')}
                            readOnly
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-gray-100"
                            {...register('family_details.income_expense.expenses.total_yearly')}
                            readOnly
                          />
                        </td>
                      </tr>

                      {/* Surplus/Deficit, Scholarship, Borrowing Section */}
                      <tr className="bg-gray-100">
                        <td className="border border-gray-300 px-3 py-2 text-center"></td>
                        <td className="border border-gray-300 px-3 py-2 font-bold">Surplus</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-gray-100"
                            {...register('family_details.income_expense.surplus_monthly')}
                            readOnly
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-gray-100"
                            {...register('family_details.income_expense.surplus_yearly')}
                            readOnly
                          />
                        </td>
                      </tr>
                      <tr className="bg-gray-100">
                        <td className="border border-gray-300 px-3 py-2 text-center"></td>
                        <td className="border border-gray-300 px-3 py-2 font-bold">Deficit</td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-gray-100"
                            {...register('family_details.income_expense.deficit_monthly')}
                            readOnly
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-gray-100"
                            {...register('family_details.income_expense.deficit_yearly')}
                            readOnly
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 text-center">3</td>
                        <td className="border border-gray-300 px-3 py-2">
                          Scholarship (Enayat/Muwasat Etc.)
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.scholarship_monthly', { 
                              valueAsNumber: true
                            })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              const monthlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.scholarship_yearly', monthlyValue * 12);
                            }}
                          />
                          {errors.family_details?.income_expense?.scholarship_monthly && (
                            <span className="text-red-500 text-xs">{errors.family_details.income_expense.scholarship_monthly.message}</span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.scholarship_yearly', { valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              const yearlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.scholarship_monthly', yearlyValue / 12);
                            }}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2 text-center">4</td>
                        <td className="border border-gray-300 px-3 py-2">
                          Borrowing/Qardan etc.
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.borrowing_monthly', { 
                              valueAsNumber: true
                            })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              const monthlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.borrowing_yearly', monthlyValue * 12);
                            }}
                          />
                          {errors.family_details?.income_expense?.borrowing_monthly && (
                            <span className="text-red-500 text-xs">{errors.family_details.income_expense.borrowing_monthly.message}</span>
                          )}
                        </td>
                        <td className="border border-gray-300 px-3 py-2">
                          <input
                            type="number"
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register('family_details.income_expense.borrowing_yearly', { valueAsNumber: true })}
                            onKeyPress={handleDecimalInput}
                            onChange={(e) => {
                              const yearlyValue = parseFloat(e.target.value) || 0;
                              setValue('family_details.income_expense.borrowing_monthly', yearlyValue / 12);
                            }}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2.4 Present Assets and Liability */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">2.4 Present Assets and Liability</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">ASSETS</h5>
                    <div className="space-y-3">
                      <Input
                        label="Residential"
                        required
                        {...register('family_details.assets_liabilities.assets.residential', { required: 'Residential assets is required' })}
                        error={errors.family_details?.assets_liabilities?.assets?.residential?.message}
                        disabled={!canUpdateSection('family')}
                        className={!canUpdateSection('family') ? 'bg-gray-100' : ''}
                      />
                      <Input
                        label="Shop/Godown/Land"
                        required
                        {...register('family_details.assets_liabilities.assets.shop_godown_land', { required: 'Shop/Godown/Land is required' })}
                        error={errors.family_details?.assets_liabilities?.assets?.shop_godown_land?.message}
                        disabled={!canUpdateSection('family')}
                        className={!canUpdateSection('family') ? 'bg-gray-100' : ''}
                      />
                      <Input
                        label="Machinery/Vehicle"
                        required
                        {...register('family_details.assets_liabilities.assets.machinery_vehicle', { required: 'Machinery/Vehicle is required' })}
                        error={errors.family_details?.assets_liabilities?.assets?.machinery_vehicle?.message}
                        disabled={!canUpdateSection('family')}
                        className={!canUpdateSection('family') ? 'bg-gray-100' : ''}
                      />
                      <Input
                        label="Stock/Raw material"
                        required
                        {...register('family_details.assets_liabilities.assets.stock_raw_material', { required: 'Stock/Raw material is required' })}
                        error={errors.family_details?.assets_liabilities?.assets?.stock_raw_material?.message}
                        disabled={!canUpdateSection('family')}
                        className={!canUpdateSection('family') ? 'bg-gray-100' : ''}
                      />
                      <Input
                        label="Goods sold on credit"
                        required
                        {...register('family_details.assets_liabilities.assets.goods_sold_credit', { required: 'Goods sold on credit is required' })}
                        error={errors.family_details?.assets_liabilities?.assets?.goods_sold_credit?.message}
                        disabled={!canUpdateSection('family')}
                        className={!canUpdateSection('family') ? 'bg-gray-100' : ''}
                      />
                      <Input
                        label="Others"
                        {...register('family_details.assets_liabilities.assets.others')}
                        error={errors.family_details?.assets_liabilities?.assets?.others?.message}
                        disabled={!canUpdateSection('family')}
                        className={!canUpdateSection('family') ? 'bg-gray-100' : ''}
                      />
                    </div>
                  </div>

                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">LIABILITY</h5>
                    <div className="space-y-3">
                      <Input
                        label="Borrowing/Qardan"
                        type="number"
                        required
                        onKeyPress={handleDecimalInput}
                        {...register('family_details.assets_liabilities.liabilities.borrowing_qardan', { required: 'Borrowing/Qardan is required', valueAsNumber: true })}
                        error={errors.family_details?.assets_liabilities?.liabilities?.borrowing_qardan?.message}
                        onChange={(e) => {
                          setValue('family_details.assets_liabilities.liabilities.borrowing_qardan', parseFloat(e.target.value) || 0);
                          calculateTotalLiabilities();
                        }}
                      />
                      <Input
                        label="Goods taken on credit"
                        type="number"
                        required
                        onKeyPress={handleDecimalInput}
                        {...register('family_details.assets_liabilities.liabilities.goods_credit', { required: 'Goods taken on credit is required', valueAsNumber: true })}
                        error={errors.family_details?.assets_liabilities?.liabilities?.goods_credit?.message}
                        onChange={(e) => {
                          setValue('family_details.assets_liabilities.liabilities.goods_credit', parseFloat(e.target.value) || 0);
                          calculateTotalLiabilities();
                        }}
                      />
                      <Input
                        label="Others"
                        type="number"
                        onKeyPress={handleDecimalInput}
                        {...register('family_details.assets_liabilities.liabilities.others', { valueAsNumber: true })}
                        error={errors.family_details?.assets_liabilities?.liabilities?.others?.message}
                        onChange={(e) => {
                          setValue('family_details.assets_liabilities.liabilities.others', parseFloat(e.target.value) || 0);
                          calculateTotalLiabilities();
                        }}
                      />
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Total Liabilities</label>
                        <input
                          type="number"
                          {...register('family_details.assets_liabilities.liabilities.total')}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSectionSaveAsDraft('family_details', watch('family_details'))}
                  disabled={saveSectionMutation.isLoading || !canUpdateSection('family')}
                  className={!canUpdateSection('family') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {saveSectionMutation.isLoading ? 'Saving...' : 'Save as Draft'}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSectionSave('family_details', watch('family_details'))}
                  disabled={saveSectionMutation.isLoading || !canUpdateSection('family')}
                  className={!canUpdateSection('family') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {saveSectionMutation.isLoading ? 'Saving...' : 'Save and Next'}
                </Button>
              </div>
            </div>
          )}

          {/* Workflow Comments for Family Details */}
          {activeTab === 'family' && canComment && (
            <WorkflowComments caseId={caseId} workflowStep="family" />
          )}

          {/* Assessment Section */}
          {activeTab === 'assessment' && (
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">3. Assessment & Counseling</h3>
                </div>
              </div>

              {/* Applicant's Background */}
              <div>
                <h4 className="text-lg font-bold italic text-blue-600 mb-4">3.1. Applicant's Background</h4>
                <div className="space-y-4">
                  <Input
                    label="3.1.1. Education"
                    required
                    {...register('assessment.background.education', { required: 'Education is required' })}
                    error={errors.assessment?.background?.education?.message}
                    disabled={!canUpdateSection('assessment')}
                    className={!canUpdateSection('assessment') ? 'bg-gray-100' : ''}
                  />
                  <Input
                    label="3.1.2. Past Business/Service Experience"
                    required
                    {...register('assessment.background.work_experience', { required: 'Work experience is required' })}
                    error={errors.assessment?.background?.work_experience?.message}
                    disabled={!canUpdateSection('assessment')}
                    className={!canUpdateSection('assessment') ? 'bg-gray-100' : ''}
                  />
                  <Input
                    label="3.1.3. Current Business/Service"
                    required
                    {...register('assessment.background.family_business', { required: 'Present Business/Family Business is required' })}
                    error={errors.assessment?.background?.family_business?.message}
                    disabled={!canUpdateSection('assessment')}
                    className={!canUpdateSection('assessment') ? 'bg-gray-100' : ''}
                  />
                  <Input
                    label="3.1.4. Skills and Knowledge"
                    required
                    {...register('assessment.background.skills_knowledge', { required: 'Skills and Knowledge is required' })}
                    error={errors.assessment?.background?.skills_knowledge?.message}
                    disabled={!canUpdateSection('assessment')}
                    className={!canUpdateSection('assessment') ? 'bg-gray-100' : ''}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      3.1.5. Counselor's assessment of applicant's profile <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${!canUpdateSection('assessment') ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      rows={4}
                      {...register('assessment.background.counselor_assessment', { required: 'Counselor assessment is required' })}
                      placeholder="Any specific positive/negative points, strength/weakness etc."
                      disabled={!canUpdateSection('assessment')}
                    />
                    {errors.assessment?.background?.counselor_assessment && (
                      <p className="text-red-500 text-sm mt-1">{errors.assessment.background.counselor_assessment.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Proposed Business */}
              <div>
                <h4 className="text-lg font-bold italic text-blue-600 mb-4">3.2. Applicant's Present Business</h4>
                <div className="space-y-4">
                  <Input
                    label="3.2.1. Present Business Condition"
                    required
                    {...register('assessment.proposed_business.present_business_condition', { required: 'Present Business Condition is required' })}
                    error={errors.assessment?.proposed_business?.present_business_condition?.message}
                    disabled={!canUpdateSection('assessment')}
                    className={!canUpdateSection('assessment') ? 'bg-gray-100' : ''}
                  />
                  
                  {/* Additional Business Information */}
                  <div className="pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            <u>Trade Mark</u> (if any) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            {...register('assessment.proposed_business.trade_mark', { required: 'Trade mark is required' })}
                            placeholder="Enter trade mark if any"
                          />
                          {errors.assessment?.proposed_business?.trade_mark && (
                            <p className="text-red-500 text-sm mt-1">{errors.assessment.proposed_business.trade_mark.message}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Online Presence (if any) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            {...register('assessment.proposed_business.online_presence', { required: 'Online presence is required' })}
                            placeholder="Website, social media, etc."
                          />
                          {errors.assessment?.proposed_business?.online_presence && (
                            <p className="text-red-500 text-sm mt-1">{errors.assessment.proposed_business.online_presence.message}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Digital / Social Media Marketing (if any) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            {...register('assessment.proposed_business.digital_marketing', { required: 'Digital marketing is required' })}
                            placeholder="Digital marketing strategies"
                          />
                          {errors.assessment?.proposed_business?.digital_marketing && (
                            <p className="text-red-500 text-sm mt-1">{errors.assessment.proposed_business.digital_marketing.message}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Physical Store Location <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            {...register('assessment.proposed_business.store_location', { required: 'Store location is required' })}
                            placeholder="Physical store address"
                          />
                          {errors.assessment?.proposed_business?.store_location && (
                            <p className="text-red-500 text-sm mt-1">{errors.assessment.proposed_business.store_location.message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  <Input
                    label="3.2.2. Sourcing: Typical Suppliers & Credit period"
                    required
                    {...register('assessment.proposed_business.sourcing', { required: 'Sourcing is required' })}
                    error={errors.assessment?.proposed_business?.sourcing?.message}
                  />
                  <Input
                    label="3.2.3. Selling: Typical Customers & Competitors"
                    required
                    {...register('assessment.proposed_business.selling', { required: 'Selling is required' })}
                    error={errors.assessment?.proposed_business?.selling?.message}
                  />
                  <Input
                    label="3.2.4. Business Expenses"
                    {...register('assessment.proposed_business.major_expenses')}
                    error={errors.assessment?.proposed_business?.major_expenses?.message}
                    disabled={!canUpdateSection('assessment')}
                    className={!canUpdateSection('assessment') ? 'bg-gray-100' : ''}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      3.2.5. From where goods purchase/credit period/cash, products/services
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={4}
                      {...register('assessment.proposed_business.goods_purchase')}
                      placeholder="Enter details about goods purchase, credit period, cash, products/services"
                      disabled={!canUpdateSection('assessment')}
                    />
                    {errors.assessment?.proposed_business?.goods_purchase && (
                      <p className="text-red-500 text-sm mt-1">{errors.assessment.proposed_business.goods_purchase.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      3.2.6. Revenue
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={4}
                      {...register('assessment.proposed_business.revenue')}
                      placeholder="Enter revenue details"
                      disabled={!canUpdateSection('assessment')}
                    />
                    {errors.assessment?.proposed_business?.revenue && (
                      <p className="text-red-500 text-sm mt-1">{errors.assessment.proposed_business.revenue.message}</p>
                    )}
                  </div>
                  <Input
                    label="3.2.7. Profit Margin"
                    {...register('assessment.proposed_business.profit_margin')}
                    error={errors.assessment?.proposed_business?.profit_margin?.message}
                    disabled={!canUpdateSection('assessment')}
                    className={!canUpdateSection('assessment') ? 'bg-gray-100' : ''}
                  />
                </div>
              </div>

              {/* Counselor's Assessment */}
              <div>
                <h4 className="text-lg font-bold italic text-blue-600 mb-4">3.3. Counsellor's Assessment of Proposed Business</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      3.3.1. Demand supply scenario of given product and services in target market <span className="text-red-500">*</span>
                      <span className="text-gray-500 text-xs ml-2">(min 100 characters)</span>
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                      {...register('assessment.counselor_assessment.demand_supply', { 
                        required: 'Demand supply scenario is required',
                        minLength: { value: 100, message: 'Minimum 100 characters required' }
                      })}
                    />
                    {errors.assessment?.counselor_assessment?.demand_supply && (
                      <p className="text-red-500 text-sm mt-1">{errors.assessment.counselor_assessment.demand_supply.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      3.3.2. Future growth potential considering applicant's present income <span className="text-red-500">*</span>
                      <span className="text-gray-500 text-xs ml-2">(min 100 characters)</span>
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                      {...register('assessment.counselor_assessment.growth_potential', { 
                        required: 'Growth potential is required',
                        minLength: { value: 100, message: 'Minimum 100 characters required' }
                      })}
                    />
                    {errors.assessment?.counselor_assessment?.growth_potential && (
                      <p className="text-red-500 text-sm mt-1">{errors.assessment.counselor_assessment.growth_potential.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      3.3.3. How the applicant will grow business? How will he compete in market and increase number of customers & profit over the years? <span className="text-red-500">*</span>
                      <span className="text-gray-500 text-xs ml-2">(min 100 characters)</span>
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                      {...register('assessment.counselor_assessment.competition_strategy', { 
                        required: 'Competition strategy is required',
                        minLength: { value: 100, message: 'Minimum 100 characters required' }
                      })}
                    />
                    {errors.assessment?.counselor_assessment?.competition_strategy && (
                      <p className="text-red-500 text-sm mt-1">{errors.assessment.counselor_assessment.competition_strategy.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSectionSaveAsDraft('assessment', watch('assessment'))}
                  disabled={saveSectionMutation.isLoading || !canUpdateSection('assessment')}
                  className={!canUpdateSection('assessment') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {saveSectionMutation.isLoading ? 'Saving...' : 'Save as Draft'}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSectionSave('assessment', watch('assessment'))}
                  disabled={saveSectionMutation.isLoading || !canUpdateSection('assessment')}
                  className={!canUpdateSection('assessment') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {saveSectionMutation.isLoading ? 'Saving...' : 'Save and Next'}
                </Button>
              </div>
            </div>
          )}

          {/* Workflow Comments for Assessment */}
          {activeTab === 'assessment' && canComment && (
            <WorkflowComments caseId={caseId} workflowStep="assessment" />
          )}

          {/* Financial Assistance Section */}
          {activeTab === 'financial' && (
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">4. Financial Assistance and Likely Growth</h3>
                </div>
              </div>

              {/* Financial Assistance Required */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">Financial assistance required</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What financials assistance may be needed to implement above mentioned business plan? <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={4}
                      {...register('financial_assistance.assistance_required', { required: 'Financial assistance required is required' })}
                      placeholder="Applicant may require investment in machinery, stock, raw material, furniture, shop (rent), packaging, promotion and marketing, business registration, etc."
                    />
                    {errors.financial_assistance?.assistance_required && (
                      <p className="text-red-500 text-sm mt-1">{errors.financial_assistance.assistance_required.message}</p>
                    )}
                  </div>

                  {/* 4.1 Action Plan */}
                  <div className="mt-6">
                    <h4 className="text-md font-medium text-gray-900 mb-4">4.1 Action Plan</h4>
                    
                    {/* Context Questions */}
                    <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
                      <div className="space-y-2 text-sm">
                        <p className="font-medium text-gray-800">
                          How the applicant can take advantage of available opportunity in phased manner?
                        </p>
                        <p className="font-medium text-gray-800">
                          What action plan is proposed over next 3 to 5 year to increase income 3 to 5 times by taking advantage of above-mentioned business opportunity?
                        </p>
                      </div>
                    </div>

                    {/* Action Plan Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr>
                            <th className="bg-yellow-100 border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Time-line
                            </th>
                            <th className="bg-yellow-100 border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Row 1: upto 1st year end */}
                          <tr>
                            <td className="bg-yellow-50 border border-gray-300 px-4 py-4 align-top w-1/4">
                              <span className="text-sm font-medium text-gray-800">upto 1st year end</span>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {actionPlanItems.upto_1st_year_end.map((item, index) => (
                                  <div key={item.id} className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-gray-700 flex-shrink-0 pt-1">
                                      {getActionNumber('upto_1st_year_end', index)}.
                                    </span>
                                    <div className="flex-1">
                                      <Input
                                        value={item.action_text}
                                        onChange={(e) => updateActionPlanItem('upto_1st_year_end', index, e.target.value)}
                                        className="w-full"
                                      />
                                    </div>
                                    {index > 0 && (
                                      <Button
                                        type="button"
                                        variant="danger"
                                        size="sm"
                                        onClick={() => removeActionPlanItem('upto_1st_year_end', index)}
                                        className="flex-shrink-0"
                                      >
                                        Remove
                                      </Button>
                                    )}
                                  </div>
                                ))}
                      <Button
                        type="button"
                        variant="outline"
                                  size="sm"
                                  onClick={() => addActionPlanItem('upto_1st_year_end')}
                      >
                                  Add Action
                      </Button>
                    </div>
                            </td>
                          </tr>

                          {/* Row 2: 2nd and 3rd year */}
                          <tr>
                            <td className="bg-yellow-50 border border-gray-300 px-4 py-4 align-top w-1/4">
                              <span className="text-sm font-medium text-gray-800">2nd and 3rd year</span>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {actionPlanItems['2nd_and_3rd_year'].map((item, index) => (
                                  <div key={item.id} className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-gray-700 flex-shrink-0 pt-1">
                                      {getActionNumber('2nd_and_3rd_year', index)}.
                                    </span>
                                    <div className="flex-1">
                            <Input
                                        value={item.action_text}
                                        onChange={(e) => updateActionPlanItem('2nd_and_3rd_year', index, e.target.value)}
                                        className="w-full"
                                      />
                                    </div>
                                    {index > 0 && (
                              <Button
                                type="button"
                                variant="danger"
                                        size="sm"
                                        onClick={() => removeActionPlanItem('2nd_and_3rd_year', index)}
                                        className="flex-shrink-0"
                              >
                                Remove
                              </Button>
                                    )}
                            </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addActionPlanItem('2nd_and_3rd_year')}
                                >
                                  Add Action
                                </Button>
                    </div>
                            </td>
                          </tr>

                          {/* Row 3: 4th and 5th year */}
                          <tr>
                            <td className="bg-yellow-50 border border-gray-300 px-4 py-4 align-top w-1/4">
                              <span className="text-sm font-medium text-gray-800">4th and 5th year</span>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {actionPlanItems['4th_and_5th_year'].map((item, index) => (
                                  <div key={item.id} className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-gray-700 flex-shrink-0 pt-1">
                                      {getActionNumber('4th_and_5th_year', index)}.
                                    </span>
                                    <div className="flex-1">
                    <Input
                                        value={item.action_text}
                                        onChange={(e) => updateActionPlanItem('4th_and_5th_year', index, e.target.value)}
                                        className="w-full"
                    />
                  </div>
                                    {index > 0 && (
                      <Button
                        type="button"
                                        variant="danger"
                        size="sm"
                                        onClick={() => removeActionPlanItem('4th_and_5th_year', index)}
                                        className="flex-shrink-0"
                      >
                                        Remove
                      </Button>
                                    )}
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addActionPlanItem('4th_and_5th_year')}
                                >
                                  Add Action
                                </Button>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    </div>
                    
                  {/* 4.2 Financial and non-financial assistance required */}
                  <div className="mt-6">
                    <h4 className="text-md font-medium text-gray-900 mb-4">4.2 Financial and non-financial assistance required</h4>
                    
                    {/* Instructional Text */}
                    <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
                      <div className="text-sm text-gray-800">
                        <p className="mb-2">
                          <strong>What financials assistance may be needed to implement the upliftment plan?</strong> Applicant may require investment in machinery, stock, raw material, furniture, shop (rent), packaging, promotion and marketing, business registration, etc.
                        </p>
                        <p>
                          Wherever applicable, provide support documents for financial assistance such as quotation, photographs, descriptions etc. in attachments.
                        </p>
                      </div>
                    </div>

                    {/* Timeline Assistance Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr>
                            <th className="bg-yellow-100 border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Time line (Tentative)
                            </th>
                            <th className="bg-yellow-100 border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Purpose (end-use) & Cost
                            </th>
                            <th className="bg-yellow-100 border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Enayat
                            </th>
                            <th className="bg-yellow-100 border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Qardan & Months**
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Row 1: Immediate */}
                          <tr>
                            <td className="bg-yellow-50 border border-gray-300 px-4 py-4 align-top w-1/5">
                              <span className="text-sm font-medium text-gray-800">Immediate</span>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {timelineAssistanceItems.immediate.map((item, index) => (
                                  <div key={item.id} className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-gray-700 flex-shrink-0 pt-1">
                                      {getTimelineAssistanceNumber('immediate', index)}.
                                    </span>
                                    <div className="flex-1">
                            <Input
                                        value={item.purpose_cost}
                                        onChange={(e) => updateTimelineAssistanceItem('immediate', index, 'purpose_cost', e.target.value)}
                                        className="w-full"
                                      />
                                    </div>
                                    {index > 0 && (
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                        onClick={() => removeTimelineAssistanceItem('immediate', index)}
                                        className="flex-shrink-0"
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addTimelineAssistanceItem('immediate')}
                                >
                                  Add Action
                                </Button>
                              </div>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {timelineAssistanceItems.immediate.map((item, index) => (
                                  <div key={item.id}>
                              <Input
                                      type="number"
                                      step="0.01"
                                      value={item.enayat}
                                      onChange={(e) => updateTimelineAssistanceItem('immediate', index, 'enayat', e.target.value)}
                                      onKeyPress={handleDecimalInput}
                                      className="w-full"
                                    />
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {timelineAssistanceItems.immediate.map((item, index) => (
                                  <div key={item.id} className="flex gap-2">
                              <Input
                                type="number"
                                      step="0.01"
                                      value={item.qardan}
                                      onChange={(e) => updateTimelineAssistanceItem('immediate', index, 'qardan', e.target.value)}
                                      onKeyPress={handleDecimalInput}
                                      placeholder="Qardan"
                                      className="flex-1"
                                    />
                                    <Input
                                      type="number"
                                      value={item.months}
                                      onChange={(e) => updateTimelineAssistanceItem('immediate', index, 'months', e.target.value)}
                                      onKeyPress={handleIntegerInput}
                                placeholder="Months"
                                      className="w-24"
                              />
                            </div>
                                ))}
                              </div>
                            </td>
                          </tr>

                          {/* Row 2: after 1st year */}
                          <tr>
                            <td className="bg-yellow-50 border border-gray-300 px-4 py-4 align-top w-1/5">
                              <span className="text-sm font-medium text-gray-800">after 1st year</span>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {timelineAssistanceItems.after_1st_yr.map((item, index) => (
                                  <div key={item.id} className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-gray-700 flex-shrink-0 pt-1">
                                      {getTimelineAssistanceNumber('after_1st_yr', index)}.
                                    </span>
                                    <div className="flex-1">
                              <Input
                                        value={item.purpose_cost}
                                        onChange={(e) => updateTimelineAssistanceItem('after_1st_yr', index, 'purpose_cost', e.target.value)}
                                        className="w-full"
                                      />
                                    </div>
                                    {index > 0 && (
                              <Button
                                type="button"
                                variant="danger"
                                        size="sm"
                                        onClick={() => removeTimelineAssistanceItem('after_1st_yr', index)}
                                        className="flex-shrink-0"
                              >
                                Remove
                              </Button>
                                    )}
                            </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addTimelineAssistanceItem('after_1st_yr')}
                                >
                                  Add Action
                                </Button>
                          </div>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {timelineAssistanceItems.after_1st_yr.map((item, index) => (
                                  <div key={item.id}>
                              <Input
                                type="number"
                                      step="0.01"
                                      value={item.enayat}
                                      onChange={(e) => updateTimelineAssistanceItem('after_1st_yr', index, 'enayat', e.target.value)}
                                      onKeyPress={handleDecimalInput}
                                      className="w-full"
                              />
                            </div>
                      ))}
                    </div>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {timelineAssistanceItems.after_1st_yr.map((item, index) => (
                                  <div key={item.id} className="flex gap-2">
                              <Input
                                      type="number"
                                      step="0.01"
                                      value={item.qardan}
                                      onChange={(e) => updateTimelineAssistanceItem('after_1st_yr', index, 'qardan', e.target.value)}
                                      onKeyPress={handleDecimalInput}
                                      placeholder="Qardan"
                                      className="flex-1"
                              />
                              <Input
                                type="number"
                                      value={item.months}
                                      onChange={(e) => updateTimelineAssistanceItem('after_1st_yr', index, 'months', e.target.value)}
                                      onKeyPress={handleIntegerInput}
                                placeholder="Months"
                                      className="w-24"
                              />
                            </div>
                                ))}
                              </div>
                            </td>
                          </tr>

                          {/* Row 3: after 2nd year */}
                          <tr>
                            <td className="bg-yellow-50 border border-gray-300 px-4 py-4 align-top w-1/5">
                              <span className="text-sm font-medium text-gray-800">after 2nd year</span>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {timelineAssistanceItems.after_2nd_yr.map((item, index) => (
                                  <div key={item.id} className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-gray-700 flex-shrink-0 pt-1">
                                      {getTimelineAssistanceNumber('after_2nd_yr', index)}.
                                    </span>
                                    <div className="flex-1">
                              <Input
                                        value={item.purpose_cost}
                                        onChange={(e) => updateTimelineAssistanceItem('after_2nd_yr', index, 'purpose_cost', e.target.value)}
                                        className="w-full"
                                      />
                                    </div>
                                    {index > 0 && (
                                      <Button
                                        type="button"
                                        variant="danger"
                                        size="sm"
                                        onClick={() => removeTimelineAssistanceItem('after_2nd_yr', index)}
                                        className="flex-shrink-0"
                                      >
                                        Remove
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addTimelineAssistanceItem('after_2nd_yr')}
                                >
                                  Add Action
                                </Button>
                              </div>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {timelineAssistanceItems.after_2nd_yr.map((item, index) => (
                                  <div key={item.id}>
                              <Input
                                type="number"
                                      step="0.01"
                                      value={item.enayat}
                                      onChange={(e) => updateTimelineAssistanceItem('after_2nd_yr', index, 'enayat', e.target.value)}
                                      onKeyPress={handleDecimalInput}
                                      className="w-full"
                              />
                            </div>
                                ))}
                              </div>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {timelineAssistanceItems.after_2nd_yr.map((item, index) => (
                                  <div key={item.id} className="flex gap-2">
                              <Input
                                      type="number"
                                      step="0.01"
                                      value={item.qardan}
                                      onChange={(e) => updateTimelineAssistanceItem('after_2nd_yr', index, 'qardan', e.target.value)}
                                      onKeyPress={handleDecimalInput}
                                      placeholder="Qardan"
                                      className="flex-1"
                              />
                              <Input
                                type="number"
                                      value={item.months}
                                      onChange={(e) => updateTimelineAssistanceItem('after_2nd_yr', index, 'months', e.target.value)}
                                      onKeyPress={handleIntegerInput}
                                placeholder="Months"
                                      className="w-24"
                              />
                            </div>
                                ))}
                          </div>
                            </td>
                          </tr>

                          {/* Row 4: after 3rd year */}
                          <tr>
                            <td className="bg-yellow-50 border border-gray-300 px-4 py-4 align-top w-1/5">
                              <span className="text-sm font-medium text-gray-800"># after 3rd year</span>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {timelineAssistanceItems.after_3rd_yr.map((item, index) => (
                                  <div key={item.id} className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-gray-700 flex-shrink-0 pt-1">
                                      {getTimelineAssistanceNumber('after_3rd_yr', index)}.
                                    </span>
                                    <div className="flex-1">
                                      <Input
                                        value={item.purpose_cost}
                                        onChange={(e) => updateTimelineAssistanceItem('after_3rd_yr', index, 'purpose_cost', e.target.value)}
                                        className="w-full"
                                      />
                                    </div>
                                    {index > 0 && (
                                      <Button
                                        type="button"
                                        variant="danger"
                                        size="sm"
                                        onClick={() => removeTimelineAssistanceItem('after_3rd_yr', index)}
                                        className="flex-shrink-0"
                                      >
                                        Remove
                                      </Button>
                                    )}
                        </div>
                      ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addTimelineAssistanceItem('after_3rd_yr')}
                                >
                                  Add Action
                                </Button>
                    </div>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {timelineAssistanceItems.after_3rd_yr.map((item, index) => (
                                  <div key={item.id}>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={item.enayat}
                                      onChange={(e) => updateTimelineAssistanceItem('after_3rd_yr', index, 'enayat', e.target.value)}
                                      onKeyPress={handleDecimalInput}
                                      className="w-full"
                                    />
                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {timelineAssistanceItems.after_3rd_yr.map((item, index) => (
                                  <div key={item.id} className="flex gap-2">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={item.qardan}
                                      onChange={(e) => updateTimelineAssistanceItem('after_3rd_yr', index, 'qardan', e.target.value)}
                                      onKeyPress={handleDecimalInput}
                                      placeholder="Qardan"
                                      className="flex-1"
                                    />
                                    <Input
                                      type="number"
                                      value={item.months}
                                      onChange={(e) => updateTimelineAssistanceItem('after_3rd_yr', index, 'months', e.target.value)}
                                      onKeyPress={handleIntegerInput}
                                      placeholder="Months"
                                      className="w-24"
                                    />
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>

                          {/* Row 5: after 4th year */}
                          <tr>
                            <td className="bg-yellow-50 border border-gray-300 px-4 py-4 align-top w-1/5">
                              <span className="text-sm font-medium text-gray-800">after 4th year</span>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {(timelineAssistanceItems.after_4th_yr || []).map((item, index) => (
                                  <div key={item.id} className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-gray-700 flex-shrink-0 pt-1">
                                      {getTimelineAssistanceNumber('after_4th_yr', index)}.
                                    </span>
                                    <div className="flex-1">
                                      <Input
                                        value={item.purpose_cost}
                                        onChange={(e) => updateTimelineAssistanceItem('after_4th_yr', index, 'purpose_cost', e.target.value)}
                                        className="w-full"
                                      />
                                    </div>
                                    {index > 0 && (
                      <Button
                        type="button"
                                        variant="danger"
                        size="sm"
                                        onClick={() => removeTimelineAssistanceItem('after_4th_yr', index)}
                                        className="flex-shrink-0"
                      >
                                        Remove
                      </Button>
                                    )}
                    </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addTimelineAssistanceItem('after_4th_yr')}
                                >
                                  Add Action
                                </Button>
                              </div>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {(timelineAssistanceItems.after_4th_yr || []).map((item, index) => (
                                  <div key={item.id}>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={item.enayat}
                                      onChange={(e) => updateTimelineAssistanceItem('after_4th_yr', index, 'enayat', e.target.value)}
                                      onKeyPress={handleDecimalInput}
                                      className="w-full"
                                    />
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {(timelineAssistanceItems.after_4th_yr || []).map((item, index) => (
                                  <div key={item.id} className="flex gap-2">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={item.qardan}
                                      onChange={(e) => updateTimelineAssistanceItem('after_4th_yr', index, 'qardan', e.target.value)}
                                      onKeyPress={handleDecimalInput}
                                      placeholder="Qardan"
                                      className="flex-1"
                                    />
                                    <Input
                                      type="number"
                                      value={item.months}
                                      onChange={(e) => updateTimelineAssistanceItem('after_4th_yr', index, 'months', e.target.value)}
                                      onKeyPress={handleIntegerInput}
                                      placeholder="Months"
                                      className="w-24"
                                    />
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>

                          {/* Row 6: 5th year */}
                          <tr>
                            <td className="bg-yellow-50 border border-gray-300 px-4 py-4 align-top w-1/5">
                              <span className="text-sm font-medium text-gray-800">5th year</span>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {(timelineAssistanceItems['5th_yr'] || []).map((item, index) => (
                                  <div key={item.id} className="flex items-start gap-2">
                                    <span className="text-sm font-medium text-gray-700 flex-shrink-0 pt-1">
                                      {getTimelineAssistanceNumber('5th_yr', index)}.
                                    </span>
                                    <div className="flex-1">
                                      <Input
                                        value={item.purpose_cost}
                                        onChange={(e) => updateTimelineAssistanceItem('5th_yr', index, 'purpose_cost', e.target.value)}
                                        className="w-full"
                                      />
                                    </div>
                                    {index > 0 && (
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                        onClick={() => removeTimelineAssistanceItem('5th_yr', index)}
                                        className="flex-shrink-0"
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                                ))}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addTimelineAssistanceItem('5th_yr')}
                                >
                                  Add Action
                                </Button>
                              </div>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {(timelineAssistanceItems['5th_yr'] || []).map((item, index) => (
                                  <div key={item.id}>
                            <Input
                                      type="number"
                                      step="0.01"
                                      value={item.enayat}
                                      onChange={(e) => updateTimelineAssistanceItem('5th_yr', index, 'enayat', e.target.value)}
                                      onKeyPress={handleDecimalInput}
                                      className="w-full"
                                    />
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                              <div className="space-y-2">
                                {(timelineAssistanceItems['5th_yr'] || []).map((item, index) => (
                                  <div key={item.id} className="flex gap-2">
                            <Input
                                      type="number"
                                      step="0.01"
                                      value={item.qardan}
                                      onChange={(e) => updateTimelineAssistanceItem('5th_yr', index, 'qardan', e.target.value)}
                                      onKeyPress={handleDecimalInput}
                                      placeholder="Qardan"
                                      className="flex-1"
                            />
                            <Input
                                      type="number"
                                      value={item.months}
                                      onChange={(e) => updateTimelineAssistanceItem('5th_yr', index, 'months', e.target.value)}
                                      onKeyPress={handleIntegerInput}
                                      placeholder="Months"
                                      className="w-24"
                                    />
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>

                          {/* Total Row */}
                          <tr className="bg-gray-50">
                            <td className="bg-yellow-50 border border-gray-300 px-4 py-4 align-top w-1/5">
                              <span className="text-sm font-semibold text-gray-900">TOTAL</span>
                            </td>
                            <td className="bg-gray-50 border border-gray-300 px-4 py-4 align-top">
                              {/* Empty for Purpose column */}
                            </td>
                            <td className="bg-gray-50 border border-gray-300 px-4 py-4 align-top">
                            <Input
                                value={calculateTotalEnayat().toFixed(2)}
                                disabled
                                className="w-full bg-gray-100"
                              />
                            </td>
                            <td className="bg-gray-50 border border-gray-300 px-4 py-4 align-top">
                            <Input
                                value={calculateTotalQardan().toFixed(2)}
                                disabled
                                className="w-full bg-gray-100"
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                          </div>
                    
                    {/* Notes below table */}
                    <div className="mt-4 space-y-2 text-sm text-gray-700">
                      <p>
                        # After 3rd year or before local Qardan can be extended to support business needs or avoid capital reduction due to ongoing Qardan repayment
                      </p>
                      <p>
                        ** Repayment can be staggered. Need NOT be equal amount during all years.
                      </p>
                        </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Self-funding Available"
                      required
                      {...register('financial_assistance.self_funding', { required: 'Self-funding available is required' })}
                      error={errors.financial_assistance?.self_funding?.message}
                    />
                    <Input
                      label="Rahen Available"
                      required
                      {...register('financial_assistance.rahen_available', { required: 'Rahen available is required' })}
                      error={errors.financial_assistance?.rahen_available?.message}
                    />
                  </div>

                  {/* Repayment Schedule */}
                  <div>
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-700">Yearly Repayment Schedule from the date of disbursement</h5>
                    </div>
                    
                    {/* QH Repayment Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr>
                            <th className="bg-yellow-100 border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Repayment
                            </th>
                            <th className="bg-yellow-100 border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Year 1
                            </th>
                            <th className="bg-yellow-100 border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Year 2
                            </th>
                            <th className="bg-yellow-100 border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Year 3
                            </th>
                            <th className="bg-yellow-100 border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Year 4
                            </th>
                            <th className="bg-yellow-100 border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-900">
                              Year 5
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* QH 1 Row - Always visible */}
                          {(() => {
                            const qh1 = qhGroups.find(g => g.name === 'QH1' || g.name === 'QH 1') || qhGroups[0];
                            return (
                              <tr>
                                <td className="bg-yellow-50 border border-gray-300 px-4 py-4 align-top">
                                  <span className="text-sm font-medium text-gray-800">QH 1</span>
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={qh1?.year1 || ''}
                                    onChange={(e) => updateQhGroupField(qh1.id, 'year1', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={qh1?.year2 || ''}
                                    onChange={(e) => updateQhGroupField(qh1.id, 'year2', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={qh1?.year3 || ''}
                                    onChange={(e) => updateQhGroupField(qh1.id, 'year3', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={qh1?.year4 || ''}
                                    onChange={(e) => updateQhGroupField(qh1.id, 'year4', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={qh1?.year5 || ''}
                                    onChange={(e) => updateQhGroupField(qh1.id, 'year5', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                              </tr>
                            );
                          })()}
                          
                          {/* QH 2 Row - Always visible */}
                          {(() => {
                            const qh2 = qhGroups.find(g => g.name === 'QH2' || g.name === 'QH 2') || qhGroups[1];
                            return (
                              <tr>
                                <td className="bg-yellow-50 border border-gray-300 px-4 py-4 align-top">
                                  <span className="text-sm font-medium text-gray-800">QH 2</span>
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={qh2?.year1 || ''}
                                    onChange={(e) => updateQhGroupField(qh2.id, 'year1', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={qh2?.year2 || ''}
                                    onChange={(e) => updateQhGroupField(qh2.id, 'year2', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={qh2?.year3 || ''}
                                    onChange={(e) => updateQhGroupField(qh2.id, 'year3', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={qh2?.year4 || ''}
                                    onChange={(e) => updateQhGroupField(qh2.id, 'year4', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={qh2?.year5 || ''}
                                    onChange={(e) => updateQhGroupField(qh2.id, 'year5', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                              </tr>
                            );
                          })()}
                          
                          {/* QH 3 Row - Always visible */}
                          {(() => {
                            const qh3 = qhGroups.find(g => g.name === 'QH3' || g.name === 'QH 3') || qhGroups[2];
                            return (
                              <tr>
                                <td className="bg-yellow-50 border border-gray-300 px-4 py-4 align-top">
                                  <span className="text-sm font-medium text-gray-800">QH 3</span>
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={qh3?.year1 || ''}
                                    onChange={(e) => updateQhGroupField(qh3.id, 'year1', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={qh3?.year2 || ''}
                                    onChange={(e) => updateQhGroupField(qh3.id, 'year2', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={qh3?.year3 || ''}
                                    onChange={(e) => updateQhGroupField(qh3.id, 'year3', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={qh3?.year4 || ''}
                                    onChange={(e) => updateQhGroupField(qh3.id, 'year4', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={qh3?.year5 || ''}
                                    onChange={(e) => updateQhGroupField(qh3.id, 'year5', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                              </tr>
                            );
                          })()}
                          
                          {/* Local QH Row - Always visible */}
                          {(() => {
                            const localQh = qhGroups.find(g => (g.name || '').toLowerCase().includes('local') || g.name === 'Local QH') || qhGroups[3];
                            return (
                              <tr>
                                <td className="bg-yellow-50 border border-gray-300 px-4 py-4 align-top">
                                  <span className="text-sm font-medium text-gray-800">Local QH</span>
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={localQh?.year1 || ''}
                                    onChange={(e) => updateQhGroupField(localQh.id, 'year1', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={localQh?.year2 || ''}
                                    onChange={(e) => updateQhGroupField(localQh.id, 'year2', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={localQh?.year3 || ''}
                                    onChange={(e) => updateQhGroupField(localQh.id, 'year3', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={localQh?.year4 || ''}
                                    onChange={(e) => updateQhGroupField(localQh.id, 'year4', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                                <td className="bg-white border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={localQh?.year5 || ''}
                                    onChange={(e) => updateQhGroupField(localQh.id, 'year5', e.target.value)}
                                    className="w-full"
                                  />
                                </td>
                              </tr>
                            );
                          })()}
                          
                          {/* TOTAL Row */}
                          <tr className="bg-gray-50">
                            <td className="bg-yellow-50 border border-gray-300 px-4 py-4 align-top">
                              <span className="text-sm font-semibold text-gray-900">TOTAL</span>
                            </td>
                            {[1, 2, 3, 4, 5].map(yearNum => {
                              const total = qhGroups.reduce((sum, group) => {
                                const yearValue = parseFloat(group[`year${yearNum}`]) || 0;
                                return sum + yearValue;
                              }, 0);
                              return (
                                <td key={yearNum} className="bg-gray-50 border border-gray-300 px-4 py-4 align-top">
                                  <Input
                                    value={total.toFixed(2)}
                                    disabled
                                    className="w-full bg-gray-100"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Support needed in below mentioned areas */}
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Support needed in below mentioned areas
                    </label>
                    
                    {/* Support Area Checkboxes with Conditional Textareas */}
                    <div className="space-y-4">
                      {/* Industry/Product Knowledge */}
                      <div className="border border-gray-200 rounded-md p-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            value="Industry/Product Knowledge"
                            {...register('financial_assistance.support_needed')}
                            className="mr-2"
                          />
                          <span className="text-sm font-medium">Industry/Product Knowledge</span>
                        </label>
                        {watch('financial_assistance.support_needed')?.includes('Industry/Product Knowledge') && (
                          <textarea
                            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            rows={2}
                            placeholder="What Industry/Product Knowledge support is needed?"
                            {...register('financial_assistance.support_industry_knowledge_desc')}
                          />
                        )}
                      </div>

                      {/* Sourcing Support */}
                      <div className="border border-gray-200 rounded-md p-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            value="Sourcing Support"
                            {...register('financial_assistance.support_needed')}
                            className="mr-2"
                          />
                          <span className="text-sm font-medium">Sourcing Support</span>
                        </label>
                        {watch('financial_assistance.support_needed')?.includes('Sourcing Support') && (
                          <textarea
                            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            rows={2}
                            placeholder="What Sourcing Support is needed?"
                            {...register('financial_assistance.support_sourcing_desc')}
                          />
                        )}
                      </div>

                      {/* Sales/Market Access */}
                      <div className="border border-gray-200 rounded-md p-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            value="Sales/Market Access"
                            {...register('financial_assistance.support_needed')}
                            className="mr-2"
                          />
                          <span className="text-sm font-medium">Sales/Market Access</span>
                        </label>
                        {watch('financial_assistance.support_needed')?.includes('Sales/Market Access') && (
                          <textarea
                            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            rows={2}
                            placeholder="What Sales/Market Access support is needed?"
                            {...register('financial_assistance.support_sales_market_desc')}
                          />
                        )}
                      </div>

                      {/* Internship/Skill Development */}
                      <div className="border border-gray-200 rounded-md p-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            value="Internship/Skill Development"
                            {...register('financial_assistance.support_needed')}
                            className="mr-2"
                          />
                          <span className="text-sm font-medium">Internship/Skill Development</span>
                        </label>
                        {watch('financial_assistance.support_needed')?.includes('Internship/Skill Development') && (
                          <textarea
                            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            rows={2}
                            placeholder="What Internship/Skill Development support is needed?"
                            {...register('financial_assistance.support_internship_desc')}
                          />
                        )}
                      </div>

                      {/* Mentoring & Handholding */}
                      <div className="border border-gray-200 rounded-md p-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            value="Mentoring & Handholding"
                            {...register('financial_assistance.support_needed')}
                            className="mr-2"
                          />
                          <span className="text-sm font-medium">Mentoring & Handholding</span>
                        </label>
                        {watch('financial_assistance.support_needed')?.includes('Mentoring & Handholding') && (
                          <textarea
                            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            rows={2}
                            placeholder="What Mentoring & Handholding support is needed?"
                            {...register('financial_assistance.support_mentoring_handholding_desc')}
                          />
                        )}
                      </div>

                      {/* Book keeping */}
                      <div className="border border-gray-200 rounded-md p-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            value="Book keeping"
                            {...register('financial_assistance.support_needed')}
                            className="mr-2"
                          />
                          <span className="text-sm font-medium">Book keeping</span>
                        </label>
                        {watch('financial_assistance.support_needed')?.includes('Book keeping') && (
                          <textarea
                            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                            rows={2}
                            placeholder="What Book keeping support is needed?"
                            {...register('financial_assistance.support_bookkeeping_desc')}
                          />
                        )}
                      </div>
                    </div>

                    {/* Mentor Section - appears when any checkbox is selected */}
                    {watch('financial_assistance.support_needed')?.length > 0 && (
                      <div className="mt-6 border-t pt-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-4">Add Mentor</h5>
                        
                        {/* Mentor ITS Input */}
                        <div className="flex gap-2 mb-4">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={mentorItsInput}
                              onChange={(e) => {
                                setMentorItsInput(e.target.value.replace(/\D/g, '').slice(0, 8));
                                setMentorError('');
                              }}
                              onKeyPress={async (e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (mentorItsInput.length !== 8) {
                                    setMentorError('ITS number must be 8 digits');
                                    return;
                                  }
                                  setMentorLoading(true);
                                  setMentorError('');
                                  try {
                                    const response = await axios.get(`/api/applicants/lookup/${mentorItsInput}`);
                                    if (response.data.success) {
                                      const mentorData = response.data.data;
                                      const currentMentors = watch('financial_assistance.support_mentors') || [];
                                      // Check if mentor already added
                                      if (currentMentors.some(m => m.its_number === mentorData.its_number)) {
                                        setMentorError('This mentor is already added');
                                      } else {
                                        setValue('financial_assistance.support_mentors', [...currentMentors, mentorData]);
                                        setMentorItsInput('');
                                      }
                                    }
                                  } catch (error) {
                                    setMentorError(error.response?.data?.error || 'Failed to find ITS number');
                                  }
                                  setMentorLoading(false);
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="Enter ITS Number (8 digits) and press Enter"
                              maxLength={8}
                            />
                            {mentorError && <p className="text-red-500 text-xs mt-1">{mentorError}</p>}
                          </div>
                          {mentorLoading && (
                            <div className="flex items-center">
                              <span className="text-gray-500 text-sm">Loading...</span>
                            </div>
                          )}
                        </div>

                        {/* Display Added Mentors */}
                        <div className="space-y-4">
                          {(watch('financial_assistance.support_mentors') || []).map((mentor, index) => (
                            <div key={index} className="border border-gray-200 rounded-md p-4 bg-gray-50">
                              <div className="flex gap-4">
                                {/* Photo */}
                                <div className="flex-shrink-0">
                                  {mentor.photo ? (
                                    <img 
                                      src={mentor.photo} 
                                      alt={mentor.name} 
                                      className="w-20 h-20 rounded-md object-cover"
                                    />
                                  ) : (
                                    <div className="w-20 h-20 rounded-md bg-gray-200 flex items-center justify-center">
                                      <span className="text-gray-400 text-xs">No Photo</span>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Mentor Details */}
                                <div className="flex-1 grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs text-gray-500">ITS Number</label>
                                    <input
                                      type="text"
                                      value={mentor.its_number || ''}
                                      readOnly
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-100"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500">Name</label>
                                    <input
                                      type="text"
                                      value={mentor.name || ''}
                                      onChange={(e) => {
                                        const mentors = [...(watch('financial_assistance.support_mentors') || [])];
                                        mentors[index].name = e.target.value;
                                        setValue('financial_assistance.support_mentors', mentors);
                                      }}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500">Contact Number</label>
                                    <input
                                      type="text"
                                      value={mentor.contact_number || ''}
                                      onChange={(e) => {
                                        const mentors = [...(watch('financial_assistance.support_mentors') || [])];
                                        mentors[index].contact_number = e.target.value;
                                        setValue('financial_assistance.support_mentors', mentors);
                                      }}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500">Email</label>
                                    <input
                                      type="email"
                                      value={mentor.email || ''}
                                      onChange={(e) => {
                                        const mentors = [...(watch('financial_assistance.support_mentors') || [])];
                                        mentors[index].email = e.target.value;
                                        setValue('financial_assistance.support_mentors', mentors);
                                      }}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                                    />
                                  </div>
                                </div>
                                
                                {/* Remove Button */}
                                <div className="flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const mentors = (watch('financial_assistance.support_mentors') || []).filter((_, i) => i !== index);
                                      setValue('financial_assistance.support_mentors', mentors);
                                    }}
                                    className="text-red-500 hover:text-red-700 text-sm"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const financialData = watch('financial_assistance');
                    financialData.qh_fields = qhGroups;
                    financialData.timeline = timelineItems;
                    financialData.action_plan = actionPlanItems;
                    financialData.timeline_assistance = timelineAssistanceItems;
                    handleSectionSaveAsDraft('financial_assistance', financialData);
                  }}
                  disabled={saveSectionMutation.isLoading || !canUpdateSection('financial')}
                  className={!canUpdateSection('financial') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {saveSectionMutation.isLoading ? 'Saving...' : 'Save as Draft'}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const financialData = watch('financial_assistance');
                    financialData.qh_fields = qhGroups;
                    financialData.timeline = timelineItems;
                    financialData.action_plan = actionPlanItems;
                    financialData.timeline_assistance = timelineAssistanceItems;
                    handleSectionSave('financial_assistance', financialData);
                  }}
                  disabled={saveSectionMutation.isLoading || !canUpdateSection('financial')}
                  className={!canUpdateSection('financial') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {saveSectionMutation.isLoading ? 'Saving...' : 'Save and Next'}
                </Button>
              </div>
            </div>
          )}

          {/* Workflow Comments for Financial Assistance */}
          {activeTab === 'financial' && canComment && (
            <WorkflowComments caseId={caseId} workflowStep="financial" />
          )}

          {/* Economic Growth Section */}
          {activeTab === 'growth' && (
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Targeted Economic Growth</h3>
                </div>
              </div>

        <div>
          {/* Revenue/Sales Section */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-2">
              1. REVENUE / Sales (Amount)
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Enter the projected revenue/sales amounts for each year.
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Present (last yr actual)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 1 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 2 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 3 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 4 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 5 (proj)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr className="bg-white">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">REVENUE / Sales (Amount) (1) <span className="text-red-500">*</span></div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.revenue_sales_last_year', { required: 'Revenue/Sales last year is required', valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.revenue_sales_year1', { required: 'Revenue/Sales year 1 is required', valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.revenue_sales_year2', { required: 'Revenue/Sales year 2 is required', valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.revenue_sales_year3', { required: 'Revenue/Sales year 3 is required', valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.revenue_sales_year4', { required: 'Revenue/Sales year 4 is required', valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.revenue_sales_year5', { required: 'Revenue/Sales year 5 is required', valueAsNumber: true })}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Expenses Section */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-2">
              2. EXPENSES
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Enter the projected expenses for each category and year.
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category and Subcategory
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Present (last yr actual)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 1 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 2 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 3 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 4 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 5 (proj)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Raw material / stock */}
                  <tr className="bg-white">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">a) Total Cost of goods sold (COGS) <span className="text-red-500">*</span></div>
                        <div className="text-sm text-gray-500">Cost of raw materials and inventory</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_raw_material_last_year', { required: 'Raw material expenses last year is required', valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_raw_material_year1', { required: 'Raw material expenses year 1 is required', valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_raw_material_year2', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_raw_material_year3', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_raw_material_year4', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_raw_material_year5', { valueAsNumber: true })}
                      />
                    </td>
                  </tr>

                  {/* Labor / salary */}
                  <tr className="bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">b) Labor / salary</div>
                        <div className="text-sm text-gray-500">Employee wages and salaries</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_labor_salary_last_year', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_labor_salary_year1', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_labor_salary_year2', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_labor_salary_year3', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_labor_salary_year4', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_labor_salary_year5', { valueAsNumber: true })}
                      />
                    </td>
                  </tr>

                  {/* Rent */}
                  <tr className="bg-white">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">c) Rent</div>
                        <div className="text-sm text-gray-500">Rental costs for premises</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_rent_last_year', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_rent_year1', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_rent_year2', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_rent_year3', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_rent_year4', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_rent_year5', { valueAsNumber: true })}
                      />
                    </td>
                  </tr>

                  {/* Overhead & Misc. */}
                  <tr className="bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">d) Overhead & Misc. (others & unforeseen)</div>
                        <div className="text-sm text-gray-500">General overheads and miscellaneous expenses</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_overhead_misc_last_year', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_overhead_misc_year1', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_overhead_misc_year2', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_overhead_misc_year3', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_overhead_misc_year4', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_overhead_misc_year5', { valueAsNumber: true })}
                      />
                    </td>
                  </tr>

                  {/* Repair, Maintenance and depreciation */}
                  <tr className="bg-white">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">e) Repair, Maintenance and depreciation</div>
                        <div className="text-sm text-gray-500">Repairs, maintenance and asset depreciation</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_repair_maintenance_depreciation_last_year', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_repair_maintenance_depreciation_year1', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_repair_maintenance_depreciation_year2', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_repair_maintenance_depreciation_year3', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_repair_maintenance_depreciation_year4', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.expenses_repair_maintenance_depreciation_year5', { valueAsNumber: true })}
                      />
                    </td>
                  </tr>

                  {/* Total Expenses */}
                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">Total Expenses (2)</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.total_expenses_last_year', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.total_expenses_year1', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.total_expenses_year2', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.total_expenses_year3', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.total_expenses_year4', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.total_expenses_year5', { valueAsNumber: true })}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Profit Section */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-2">
              3. PROFIT [(1)-(2)]
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Enter the projected profit and deductions for each year.
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category and Subcategory
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Present (last yr actual)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 1 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 2 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 3 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 4 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 5 (proj)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Main Profit */}
                  <tr className="bg-green-50 border-t-2 border-green-200">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">PROFIT [(1)-(2)]</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.profit_last_year', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.profit_year1', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.profit_year2', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.profit_year3', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.profit_year4', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.profit_year5', { valueAsNumber: true })}
                      />
                    </td>
                  </tr>

                  {/* Fund blocked in Credit & Dead stock */}
                  <tr className="bg-white">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">(-) Fund blocked in Credit & Dead stock</div>
                        <div className="text-sm text-gray-500">Funds tied up in credit or unsellable inventory</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_fund_blocked_last_year', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_fund_blocked_year1', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_fund_blocked_year2', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_fund_blocked_year3', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_fund_blocked_year4', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_fund_blocked_year5', { valueAsNumber: true })}
                      />
                    </td>
                  </tr>

                  {/* Qardan Repayment */}
                  <tr className="bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">(-) Qardan Repayment</div>
                        <div className="text-sm text-gray-500">Repayment of Qardan loans</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_qardan_repayment_last_year', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_qardan_repayment_year1', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_qardan_repayment_year2', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_qardan_repayment_year3', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_qardan_repayment_year4', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_qardan_repayment_year5', { valueAsNumber: true })}
                      />
                    </td>
                  </tr>

                  {/* Other Income */}
                  <tr className="bg-white">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">(-) Other Income</div>
                        <div className="text-sm text-gray-500">Family Income and others</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_other_income_last_year', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_other_income_year1', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_other_income_year2', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_other_income_year3', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_other_income_year4', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_other_income_year5', { valueAsNumber: true })}
                      />
                    </td>
                  </tr>

                  {/* House hold expense */}
                  <tr className="bg-white">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">(-) House hold expense</div>
                        <div className="text-sm text-gray-500">Household expenses drawn from business profits</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_household_expense_last_year', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_household_expense_year1', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_household_expense_year2', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_household_expense_year3', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_household_expense_year4', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.profit_household_expense_year5', { valueAsNumber: true })}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Cash Surplus Section */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-2">
              4. CASH SURPLUS
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              Enter the projected cash surplus and additional Qardan for each year.
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category and Subcategory
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Present (last yr actual)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 1 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 2 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 3 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 4 (proj)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year 5 (proj)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Main Cash Surplus */}
                  <tr className="bg-yellow-50 border-t-2 border-yellow-200">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">CASH SURPLUS</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.cash_surplus_last_year', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.cash_surplus_year1', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.cash_surplus_year2', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.cash_surplus_year3', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.cash_surplus_year4', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        disabled={true}
                        className="w-full text-center font-semibold bg-gray-100"
                        {...register('economic_growth.cash_surplus_year5', { valueAsNumber: true })}
                      />
                    </td>
                  </tr>

                  {/* Additional Enayat */}
                  <tr className="bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">(+) Additional Enayat</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.cash_surplus_additional_enayat_last_year', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.cash_surplus_additional_enayat_year1', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.cash_surplus_additional_enayat_year2', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.cash_surplus_additional_enayat_year3', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.cash_surplus_additional_enayat_year4', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.cash_surplus_additional_enayat_year5', { valueAsNumber: true })}
                      />
                    </td>
                  </tr>

                  {/* Additional Qardan */}
                  <tr className="bg-white">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">(+) Additional Qardan</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.cash_surplus_additional_qardan_last_year', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.cash_surplus_additional_qardan_year1', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.cash_surplus_additional_qardan_year2', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.cash_surplus_additional_qardan_year3', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.cash_surplus_additional_qardan_year4', { valueAsNumber: true })}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full text-center"
                        {...register('economic_growth.cash_surplus_additional_qardan_year5', { valueAsNumber: true })}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-600 mt-4">
              ** In the years if there is deficit in initial years, provision for additional Qardan may be kept at the end of the year to fill the deficit. Also, the applicant will be eligible to take additional local qardan if his business grows and exiting qardan is insufficient for available growth opportunity.
            </p>
          </div>

          <div className="mb-4">
            <h4 className="text-md font-medium text-gray-900 mb-2">
              5. Business assets owned (at the end of the year)
            </h4>
            <p className="text-sm text-gray-600">
              Enter the projected values for business assets and liabilities for each year.
            </p>
          </div>

                {/* Business Assets Table */}
                <div className="overflow-x-auto mb-6">
                  <table className="min-w-full bg-white border border-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category and Subcategory
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Year / As of now (actual)
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Year 1 (proj)
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Year 2 (proj)
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Year 3 (proj)
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Year 4 (proj)
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Year 5 (proj)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* Cash in Hand */}
                      <tr className="bg-white">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">a) Cash in Hand</div>
                            <div className="text-sm text-gray-500">Cash available in hand</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.cash_in_hand_last_year', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.cash_in_hand_year1', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.cash_in_hand_year2', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.cash_in_hand_year3', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.cash_in_hand_year4', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.cash_in_hand_year5', { valueAsNumber: true })}
                          />
                        </td>
                      </tr>

                      {/* Raw materials / stock */}
                      <tr className="bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">b) Raw materials / stock</div>
                            <div className="text-sm text-gray-500">Raw materials and stock inventory</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.raw_materials_last_year', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.raw_materials_year1', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.raw_materials_year2', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.raw_materials_year3', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.raw_materials_year4', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.raw_materials_year5', { valueAsNumber: true })}
                          />
                        </td>
                      </tr>

                      {/* Sale on Credit */}
                      <tr className="bg-white">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">c) Sale on Credit **</div>
                            <div className="text-sm text-gray-500">Amount receivable from credit sales</div>
                        </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.sale_on_credit_last_year', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.sale_on_credit_year1', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.sale_on_credit_year2', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.sale_on_credit_year3', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.sale_on_credit_year4', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.sale_on_credit_year5', { valueAsNumber: true })}
                          />
                        </td>
                      </tr>

                      {/* Machines / Equipment */}
                      <tr className="bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">d) Machines / Equip.</div>
                            <div className="text-sm text-gray-500">Machinery and equipment value</div>
                      </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.machines_equipment_last_year', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.machines_equipment_year1', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.machines_equipment_year2', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.machines_equipment_year3', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.machines_equipment_year4', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.machines_equipment_year5', { valueAsNumber: true })}
                          />
                        </td>
                      </tr>

                      {/* Vehicles */}
                      <tr className="bg-white">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">e) Vehicles</div>
                            <div className="text-sm text-gray-500">Vehicle assets value</div>
                </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.vehicles_last_year', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.vehicles_year1', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.vehicles_year2', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.vehicles_year3', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.vehicles_year4', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.vehicles_year5', { valueAsNumber: true })}
                          />
                        </td>
                      </tr>

                      {/* Shop / Godown etc. */}
                      <tr className="bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">f) Shop / Godown etc.</div>
                            <div className="text-sm text-gray-500">Shop, godown and property value</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.shop_godown_last_year', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.shop_godown_year1', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.shop_godown_year2', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.shop_godown_year3', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.shop_godown_year4', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.shop_godown_year5', { valueAsNumber: true })}
                          />
                        </td>
                      </tr>

                      {/* Trademark / Goodwill */}
                      <tr className="bg-white">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">g) Trademark / Goodwill</div>
                            <div className="text-sm text-gray-500">Trademark and goodwill value</div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.trademark_goodwill_last_year', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.trademark_goodwill_year1', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.trademark_goodwill_year2', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.trademark_goodwill_year3', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.trademark_goodwill_year4', { valueAsNumber: true })}
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-full text-center"
                            {...register('economic_growth.trademark_goodwill_year5', { valueAsNumber: true })}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Business Liabilities Section */}
                <div className="mt-8">
                  <h4 className="text-md font-medium text-gray-900 mb-4">
                    6. Business liability - other than Qardan
                  </h4>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category and Subcategory
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Year / As of now (actual)
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Year 1 (proj)
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Year 2 (proj)
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Year 3 (proj)
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Year 4 (proj)
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Year 5 (proj)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {/* Purchase on Credit */}
                        <tr className="bg-white">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">h) Purchase on Credit **</div>
                              <div className="text-sm text-gray-500">Amount payable for credit purchases</div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-full text-center"
                              {...register('economic_growth.purchase_on_credit_last_year', { valueAsNumber: true })}
                            />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-full text-center"
                              {...register('economic_growth.purchase_on_credit_year1', { valueAsNumber: true })}
                            />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-full text-center"
                              {...register('economic_growth.purchase_on_credit_year2', { valueAsNumber: true })}
                            />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-full text-center"
                              {...register('economic_growth.purchase_on_credit_year3', { valueAsNumber: true })}
                            />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-full text-center"
                              {...register('economic_growth.purchase_on_credit_year4', { valueAsNumber: true })}
                            />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-full text-center"
                              {...register('economic_growth.purchase_on_credit_year5', { valueAsNumber: true })}
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="mb-4 mt-4">
                <p className="text-sm text-gray-600">
                  ** The applicant is encouraged to do Sale and Purchase both on CASH and NOT on Credit
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSectionSaveAsDraft('economic_growth', watch('economic_growth'))}
                  disabled={saveSectionMutation.isLoading || !canUpdateSection('growth')}
                  className={!canUpdateSection('growth') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {saveSectionMutation.isLoading ? 'Saving...' : 'Save as Draft'}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSectionSave('economic_growth', watch('economic_growth'))}
                  disabled={saveSectionMutation.isLoading || !canUpdateSection('growth')}
                  className={!canUpdateSection('growth') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {saveSectionMutation.isLoading ? 'Saving...' : 'Save and Next'}
                </Button>
              </div>
            </div>
          )}

          {/* Workflow Comments for Economic Growth */}
          {activeTab === 'growth' && canComment && (
            <WorkflowComments caseId={caseId} workflowStep="growth" />
          )}

          {/* Declaration Section */}
          {activeTab === 'declaration' && (
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">5. Declaration</h3>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="block text-sm font-medium text-gray-700 mb-3">
                    The applicant hereby confirms that:
                  </h4>
                  <div className="bg-gray-50 p-4 rounded-md border">
                    <div className="text-sm text-gray-800 space-y-2">
                      <p>1. The information provided about his personal, family and present business are correct and free of any error</p>
                      <p>2. He/she has understood the details filled in this form and purpose and content of Economic Upliftment Plan.</p>
                      <p>3. By signing this form, he is applying for Enayat and Qardan amount as mentioned in 4.2 above</p>
                      <p>4. Any amount granted against this application will be utilized only for economic upliftment purpose as mentioned in this application.</p>
                    </div>
                  </div>
                </div>

                <Input
                  label="Any other comments"
                  {...register('declaration.other_comments')}
                  error={errors.declaration?.other_comments?.message}
                />

                {/* Applicant Information Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700 border-b border-gray-200 pb-2">
                    Applicant Information
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Applicant ITS Number - Auto-filled from personal details */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ITS Number
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                        value={watch('declaration.applicant_its') || 'Loading...'}
                        readOnly
                        {...register('declaration.applicant_its')}
                      />
                    </div>

                    {/* Applicant Name - Auto-filled from personal details */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Applicant Name
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                        value={watch('declaration.applicant_name') || 'Loading...'}
                        readOnly
                        {...register('declaration.applicant_name')}
                      />
                    </div>

                    {/* Contact Number - Auto-filled from personal details */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Number
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                        value={watch('declaration.applicant_contact') || 'Loading...'}
                        readOnly
                        {...register('declaration.applicant_contact')}
                      />
                    </div>
                  </div>

                  {/* Date Picker */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Declaration Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      {...register('declaration.declaration_date', { required: 'Declaration date is required' })}
                    />
                  </div>

                  {/* Signature Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Signature
                    </label>
                    
                    {/* Signature Type Selection */}
                    <div className="mb-4">
                      <div className="flex space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="draw"
                            {...register('declaration.signature_type', { value: 'draw' })}
                            className="mr-2"
                            defaultChecked
                          />
                          <span className="text-sm text-gray-700">Draw Signature</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="upload"
                            {...register('declaration.signature_type', { value: 'upload' })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Upload Signature</span>
                        </label>
                      </div>
                    </div>

                    {/* Signature Input based on type */}
                    {watch('declaration.signature_type') === 'draw' ? (
                      <SignaturePad
                        value={watch('declaration.signature_drawing_data')}
                        onChange={(value) => setValue('declaration.signature_drawing_data', value)}
                        error={errors.declaration?.signature_drawing_data?.message}
                      />
                    ) : (
                      <div>
                        {watch('declaration.signature_file_path') ? (
                          <div className="space-y-2">
                            <img
                              src={watch('declaration.signature_file_path')}
                              alt="Applicant signature"
                              className="max-h-24 border border-gray-200 rounded object-contain bg-gray-50"
                            />
                            <p className="text-sm text-gray-600">Signature image uploaded</p>
                            <button
                              type="button"
                              onClick={() => setValue('declaration.signature_file_path', '')}
                              className="text-sm text-primary-600 hover:underline"
                            >
                              Change signature
                            </button>
                          </div>
                        ) : (
                          <>
                            <input
                              type="file"
                              accept="image/*"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    setValue('declaration.signature_file_path', event.target.result);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Upload a signature image file (PNG, JPG, etc.)
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="block text-sm font-medium text-gray-700 mb-3">
                    The counsellor hereby confirms that:
                  </h4>
                  <div className="bg-gray-50 p-4 rounded-md border">
                    <div className="text-sm text-gray-800 space-y-2">
                      <p>1. The applicant's potential has been assessed and proposed action plan has been explained to the applicant along with the larger objective of the upliftment program.</p>
                      <p>2. The proposed business/economic activity has potential in the suggested location and will increase income of the applicant over next three to five year in sustainable manner.</p>
                      <p>3. The recommended economic upliftment plan is realistic and feasible in local mauze context.</p>
                    </div>
                  </div>
                </div>

                <Input
                  label="Any other comments"
                  {...register('declaration.counselor_comments')}
                  error={errors.declaration?.counselor_comments?.message}
                />

                {/* Counselor Information Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700 border-b border-gray-200 pb-2">
                    Counselor Information
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Counselor ITS Number - Auto-filled from assigned counselor */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ITS Number
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                        value={watch('declaration.counselor_its') || 'Loading...'}
                        readOnly
                        {...register('declaration.counselor_its')}
                      />
                    </div>

                    {/* Counselor Name - Auto-filled from assigned counselor */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Counselor Name
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                        value={watch('declaration.counselor_name') || 'Loading...'}
                        readOnly
                        {...register('declaration.counselor_name')}
                      />
                    </div>

                    {/* Counselor Contact Number - Auto-filled from assigned counselor */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Number
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                        value={watch('declaration.counselor_contact') || 'Loading...'}
                        readOnly
                        {...register('declaration.counselor_contact')}
                      />
                    </div>
                  </div>

                  {/* Counselor Date Picker */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      {...register('declaration.counselor_date')}
                    />
                  </div>

                  {/* Counselor Signature Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Signature
                    </label>
                    
                    {/* Signature Type Selection */}
                    <div className="mb-4">
                      <div className="flex space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="draw"
                            {...register('declaration.counselor_signature_type', { value: 'draw' })}
                            className="mr-2"
                            defaultChecked
                          />
                          <span className="text-sm text-gray-700">Draw Signature</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="upload"
                            {...register('declaration.counselor_signature_type', { value: 'upload' })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Upload Signature</span>
                        </label>
                      </div>
                    </div>

                    {/* Signature Input based on type */}
                    {watch('declaration.counselor_signature_type') === 'draw' ? (
                      <SignaturePad
                        value={watch('declaration.counselor_signature_drawing_data')}
                        onChange={(value) => setValue('declaration.counselor_signature_drawing_data', value)}
                        error={errors.declaration?.counselor_signature_drawing_data?.message}
                      />
                    ) : (
                      <div>
                        {watch('declaration.counselor_signature_file_path') ? (
                          <div className="space-y-2">
                            <img
                              src={watch('declaration.counselor_signature_file_path')}
                              alt="Counselor signature"
                              className="max-h-24 border border-gray-200 rounded object-contain bg-gray-50"
                            />
                            <p className="text-sm text-gray-600">Signature image uploaded</p>
                            <button
                              type="button"
                              onClick={() => setValue('declaration.counselor_signature_file_path', '')}
                              className="text-sm text-primary-600 hover:underline"
                            >
                              Change signature
                            </button>
                          </div>
                        ) : (
                          <>
                            <input
                              type="file"
                              accept="image/*"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    setValue('declaration.counselor_signature_file_path', event.target.result);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Upload a signature image file (PNG, JPG, etc.)
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* TR Committee Member Information Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700 border-b border-gray-200 pb-2">
                    TR Committee Member Information
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* TR Committee Member ITS Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ITS Number
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={trCommitteeItsInput || watch('declaration.tr_committee_its') || ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 8);
                            setTrCommitteeItsInput(value);
                            setTrCommitteeError('');
                          }}
                          onKeyPress={async (e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const itsValue = trCommitteeItsInput || watch('declaration.tr_committee_its') || '';
                              if (!itsValue || itsValue.length !== 8) {
                                setTrCommitteeError('ITS number must be 8 digits');
                                return;
                              }
                              setTrCommitteeLoading(true);
                              setTrCommitteeError('');
                              try {
                                const response = await axios.get(`/api/applicants/lookup/${itsValue}`);
                                if (response.data.success) {
                                  const memberData = response.data.data;
                                  setValue('declaration.tr_committee_its', memberData.its_number);
                                  setValue('declaration.tr_committee_name', memberData.name);
                                  setValue('declaration.tr_committee_contact', memberData.contact_number);
                                  setTrCommitteeItsInput('');
                                }
                              } catch (error) {
                                setTrCommitteeError(error.response?.data?.error || 'Failed to find ITS number');
                              }
                              setTrCommitteeLoading(false);
                            }
                          }}
                          onBlur={() => {
                            // Update form value when input loses focus
                            if (trCommitteeItsInput) {
                              setValue('declaration.tr_committee_its', trCommitteeItsInput);
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="Enter ITS Number (8 digits) and press Enter"
                          maxLength={8}
                        />
                        {trCommitteeLoading && (
                          <div className="flex items-center">
                            <span className="text-gray-500 text-sm">Loading...</span>
                          </div>
                        )}
                      </div>
                      {trCommitteeError && <p className="text-red-500 text-xs mt-1">{trCommitteeError}</p>}
                    </div>

                    {/* TR Committee Member Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        TR Committee Member Name
                      </label>
                      <input
                        type="text"
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          watch('declaration.tr_committee_name') ? 'bg-gray-50 text-gray-600' : ''
                        }`}
                        value={watch('declaration.tr_committee_name') || ''}
                        readOnly={!!watch('declaration.tr_committee_name')}
                        {...register('declaration.tr_committee_name')}
                        placeholder="Enter TR committee member name or lookup by ITS"
                      />
                    </div>

                    {/* TR Committee Member Contact Number */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Number
                      </label>
                      <input
                        type="text"
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                          watch('declaration.tr_committee_contact') ? 'bg-gray-50 text-gray-600' : ''
                        }`}
                        value={watch('declaration.tr_committee_contact') || ''}
                        readOnly={!!watch('declaration.tr_committee_contact')}
                        {...register('declaration.tr_committee_contact')}
                        placeholder="Enter contact number or lookup by ITS"
                      />
                    </div>
                  </div>

                  {/* TR Committee Member Date Picker */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      {...register('declaration.tr_committee_date')}
                    />
                  </div>

                  {/* TR Committee Member Signature Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Signature
                    </label>
                    
                    {/* Signature Type Selection */}
                    <div className="mb-4">
                      <div className="flex space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="draw"
                            {...register('declaration.tr_committee_signature_type', { value: 'draw' })}
                            className="mr-2"
                            defaultChecked
                          />
                          <span className="text-sm text-gray-700">Draw Signature</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="upload"
                            {...register('declaration.tr_committee_signature_type', { value: 'upload' })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Upload Signature</span>
                        </label>
                      </div>
                    </div>

                    {/* Signature Input based on type */}
                    {watch('declaration.tr_committee_signature_type') === 'draw' ? (
                      <SignaturePad
                        value={watch('declaration.tr_committee_signature_drawing_data')}
                        onChange={(value) => setValue('declaration.tr_committee_signature_drawing_data', value)}
                        error={errors.declaration?.tr_committee_signature_drawing_data?.message}
                      />
                    ) : (
                      <div>
                        {watch('declaration.tr_committee_signature_file_path') ? (
                          <div className="space-y-2">
                            <img
                              src={watch('declaration.tr_committee_signature_file_path')}
                              alt="TR Committee signature"
                              className="max-h-24 border border-gray-200 rounded object-contain bg-gray-50"
                            />
                            <p className="text-sm text-gray-600">Signature image uploaded</p>
                            <button
                              type="button"
                              onClick={() => setValue('declaration.tr_committee_signature_file_path', '')}
                              className="text-sm text-primary-600 hover:underline"
                            >
                              Change signature
                            </button>
                          </div>
                        ) : (
                          <>
                            <input
                              type="file"
                              accept="image/*"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    setValue('declaration.tr_committee_signature_file_path', event.target.result);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Upload a signature image file (PNG, JPG, etc.)
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSectionSaveAsDraft('declaration', watch('declaration'))}
                  disabled={saveSectionMutation.isLoading || !canUpdateSection('declaration')}
                  className={!canUpdateSection('declaration') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {saveSectionMutation.isLoading ? 'Saving...' : 'Save as Draft'}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSectionSave('declaration', watch('declaration'))}
                  disabled={saveSectionMutation.isLoading || !canUpdateSection('declaration')}
                  className={!canUpdateSection('declaration') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {saveSectionMutation.isLoading ? 'Saving...' : 'Save and Next'}
                </Button>
              </div>
            </div>
          )}

          {/* Workflow Comments for Declaration */}
          {activeTab === 'declaration' && canComment && (
            <WorkflowComments caseId={caseId} workflowStep="declaration" />
          )}

          {/* Attachments Section */}
          {activeTab === 'attachments' && (
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">6. Attachments</h3>
                </div>
                {attachmentsLoading && (
                  <p className="text-sm text-blue-600 mt-2">Loading existing attachments...</p>
                )}
                {attachmentsError && (
                  <p className="text-sm text-red-600 mt-2">Error loading attachments: {attachmentsError.message}</p>
                )}
                {existingAttachments && (
                  <p className="text-sm text-green-600 mt-2">Found {existingAttachments.length} existing attachments</p>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">Mandatory</h4>
                  <div className="space-y-4">
                    {/* Work Place Photo - Multiple files allowed */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center mb-3">
                        <input
                          type="checkbox"
                          {...register('attachments.work_place_photo')}
                          className="mr-3"
                        />
                        <span className="font-medium">Photograph of existing place of work and proposed place of business</span>
                      </label>
                      <div className="ml-6 space-y-2">
                        {watch('attachments.work_place_photo_files')?.map((file, index) => (
                          <div key={file.id || index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-700">{file.name}</span>
                              {file.id && (
                                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                  Uploaded
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {file.id && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const response = await axios.get(`/api/attachments/download/${file.id}`, {
                                        responseType: 'blob'
                                      });
                                      
                                      // Get the content type from the response headers
                                      const contentType = response.headers['content-type'] || 'application/octet-stream';
                                      
                                      // Create blob with the correct MIME type
                                      const blob = new Blob([response.data], { type: contentType });
                                      const url = window.URL.createObjectURL(blob);
                                      window.open(url, '_blank');
                                      
                                      // Clean up the URL object after a delay
                                      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                                    } catch (error) {
                                      console.error('Error downloading file:', error);
                                      setError('Failed to download file');
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  View
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canUpdateSection('attachments')) {
                                    setError('You do not have permission');
                                    return;
                                  }
                                  const files = watch('attachments.work_place_photo_files') || [];
                                  const newFiles = files.filter((_, i) => i !== index);
                                  setValue('attachments.work_place_photo_files', newFiles);
                                }}
                                disabled={!canUpdateSection('attachments')}
                                className={`text-red-600 hover:text-red-800 text-sm ${!canUpdateSection('attachments') ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center space-x-2">
                          <input
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx"
                            className={`text-sm ${!canUpdateSection('attachments') ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!canUpdateSection('attachments')}
                            onChange={(e) => {
                              if (!canUpdateSection('attachments')) {
                                e.target.value = '';
                                return;
                              }
                              const files = Array.from(e.target.files);
                              
                              // Validate file sizes
                              const invalidFiles = [];
                              files.forEach(file => {
                                const error = validateFileSize(file);
                                if (error) {
                                  invalidFiles.push(error);
                                }
                              });
                              
                              if (invalidFiles.length > 0) {
                                setError(invalidFiles.join('\n'));
                                e.target.value = '';
                                return;
                              }
                              
                              const existingFiles = watch('attachments.work_place_photo_files') || [];
                              setValue('attachments.work_place_photo_files', [...existingFiles, ...files]);
                              e.target.value = '';
                            }}
                          />
                          <button
                            type="button"
                            disabled={!canUpdateSection('attachments')}
                            className={`bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 ${!canUpdateSection('attachments') ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => {
                              if (!canUpdateSection('attachments')) {
                                setError('You do not have permission');
                                return;
                              }
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.multiple = true;
                              input.accept = 'image/*,.pdf,.doc,.docx';
                              input.onchange = (e) => {
                                const files = Array.from(e.target.files);
                                
                                // Validate file sizes
                                const invalidFiles = [];
                                files.forEach(file => {
                                  const error = validateFileSize(file);
                                  if (error) {
                                    invalidFiles.push(error);
                                  }
                                });
                                
                                if (invalidFiles.length > 0) {
                                  setError(invalidFiles.join('\n'));
                                  return;
                                }
                                
                                const existingFiles = watch('attachments.work_place_photo_files') || [];
                                setValue('attachments.work_place_photo_files', [...existingFiles, ...files]);
                              };
                              input.click();
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quotation - Single file */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center mb-3">
                        <input
                          type="checkbox"
                          {...register('attachments.quotation')}
                          className="mr-3"
                          disabled={!canUpdateSection('attachments')}
                        />
                        <span className="font-medium">Quotation of end-use of Qardan amount whenever possible</span>
                      </label>
                      <div className="ml-6">
                        {watch('attachments.quotation_file') && (
                          <div className="flex items-center justify-between bg-gray-50 p-2 rounded mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-700">{watch('attachments.quotation_file').name}</span>
                              {watch('attachments.quotation_file').id && (
                                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                  Uploaded
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {watch('attachments.quotation_file').id && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const fileId = watch('attachments.quotation_file').id;
                                      const response = await axios.get(`/api/attachments/download/${fileId}`, {
                                        responseType: 'blob'
                                      });
                                      
                                      // Get the content type from the response headers
                                      const contentType = response.headers['content-type'] || 'application/octet-stream';
                                      
                                      // Create blob with the correct MIME type
                                      const blob = new Blob([response.data], { type: contentType });
                                      const url = window.URL.createObjectURL(blob);
                                      window.open(url, '_blank');
                                      
                                      // Clean up the URL object after a delay
                                      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                                    } catch (error) {
                                      console.error('Error downloading file:', error);
                                      setError('Failed to download file');
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  View
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canUpdateSection('attachments')) {
                                    setError('You do not have permission');
                                    return;
                                  }
                                  setValue('attachments.quotation_file', null);
                                }}
                                disabled={!canUpdateSection('attachments')}
                                className={`text-red-600 hover:text-red-800 text-sm ${!canUpdateSection('attachments') ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                          className={`text-sm ${!canUpdateSection('attachments') ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={!canUpdateSection('attachments')}
                          onChange={(e) => {
                            if (!canUpdateSection('attachments')) {
                              e.target.value = '';
                              return;
                            }
                            const file = e.target.files[0];
                            if (file) {
                              // Validate file size
                              const error = validateFileSize(file);
                              if (error) {
                                setError(error);
                                e.target.value = '';
                                return;
                              }
                              
                              setValue('attachments.quotation_file', file);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Product Brochure - Multiple files allowed */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center mb-3">
                        <input
                          type="checkbox"
                          {...register('attachments.product_brochure')}
                          className="mr-3"
                          disabled={!canUpdateSection('attachments')}
                        />
                        <span className="font-medium">Product brochure / marketing material / photograph (if any)</span>
                      </label>
                      <div className="ml-6 space-y-2">
                        {watch('attachments.product_brochure_files')?.map((file, index) => (
                          <div key={file.id || index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-700">{file.name}</span>
                              {file.id && (
                                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                  Uploaded
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {file.id && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const response = await axios.get(`/api/attachments/download/${file.id}`, {
                                        responseType: 'blob'
                                      });
                                      
                                      // Get the content type from the response headers
                                      const contentType = response.headers['content-type'] || 'application/octet-stream';
                                      
                                      // Create blob with the correct MIME type
                                      const blob = new Blob([response.data], { type: contentType });
                                      const url = window.URL.createObjectURL(blob);
                                      window.open(url, '_blank');
                                      
                                      // Clean up the URL object after a delay
                                      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                                    } catch (error) {
                                      console.error('Error downloading file:', error);
                                      setError('Failed to download file');
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  View
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canUpdateSection('attachments')) {
                                    setError('You do not have permission');
                                    return;
                                  }
                                  const files = watch('attachments.product_brochure_files') || [];
                                  const newFiles = files.filter((_, i) => i !== index);
                                  setValue('attachments.product_brochure_files', newFiles);
                                }}
                                disabled={!canUpdateSection('attachments')}
                                className={`text-red-600 hover:text-red-800 text-sm ${!canUpdateSection('attachments') ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center space-x-2">
                          <input
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx"
                            className={`text-sm ${!canUpdateSection('attachments') ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!canUpdateSection('attachments')}
                            onChange={(e) => {
                              if (!canUpdateSection('attachments')) {
                                e.target.value = '';
                                return;
                              }
                              const files = Array.from(e.target.files);
                              
                              // Validate file sizes
                              const invalidFiles = [];
                              files.forEach(file => {
                                const error = validateFileSize(file);
                                if (error) {
                                  invalidFiles.push(error);
                                }
                              });
                              
                              if (invalidFiles.length > 0) {
                                setError(invalidFiles.join('\n'));
                                e.target.value = '';
                                return;
                              }
                              
                              const existingFiles = watch('attachments.product_brochure_files') || [];
                              setValue('attachments.product_brochure_files', [...existingFiles, ...files]);
                              e.target.value = '';
                            }}
                          />
                          <button
                            type="button"
                            disabled={!canUpdateSection('attachments')}
                            className={`bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 ${!canUpdateSection('attachments') ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => {
                              if (!canUpdateSection('attachments')) {
                                setError('You do not have permission');
                                return;
                              }
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.multiple = true;
                              input.accept = 'image/*,.pdf,.doc,.docx';
                              input.onchange = (e) => {
                                const files = Array.from(e.target.files);
                                
                                // Validate file sizes
                                const invalidFiles = [];
                                files.forEach(file => {
                                  const error = validateFileSize(file);
                                  if (error) {
                                    invalidFiles.push(error);
                                  }
                                });
                                
                                if (invalidFiles.length > 0) {
                                  setError(invalidFiles.join('\n'));
                                  return;
                                }
                                
                                const existingFiles = watch('attachments.product_brochure_files') || [];
                                setValue('attachments.product_brochure_files', [...existingFiles, ...files]);
                              };
                              input.click();
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">Optional</h4>
                  <div className="space-y-4">
                    {/* Income Tax Return - Single file */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center mb-3">
                        <input
                          type="checkbox"
                          {...register('attachments.income_tax_return')}
                          className="mr-3"
                        />
                        <span className="font-medium">Income Tax Return</span>
                      </label>
                      <div className="ml-6">
                        {watch('attachments.income_tax_return_file') && (
                          <div className="flex items-center justify-between bg-gray-50 p-2 rounded mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-700">{watch('attachments.income_tax_return_file').name}</span>
                              {watch('attachments.income_tax_return_file').id && (
                                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                  Uploaded
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {watch('attachments.income_tax_return_file').id && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const fileId = watch('attachments.income_tax_return_file').id;
                                      const response = await axios.get(`/api/attachments/download/${fileId}`, {
                                        responseType: 'blob'
                                      });
                                      
                                      // Get the content type from the response headers
                                      const contentType = response.headers['content-type'] || 'application/octet-stream';
                                      
                                      // Create blob with the correct MIME type
                                      const blob = new Blob([response.data], { type: contentType });
                                      const url = window.URL.createObjectURL(blob);
                                      window.open(url, '_blank');
                                      
                                      // Clean up the URL object after a delay
                                      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                                    } catch (error) {
                                      console.error('Error downloading file:', error);
                                      setError('Failed to download file');
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  View
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setValue('attachments.income_tax_return_file', null)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                          className="text-sm"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              // Validate file size
                              const error = validateFileSize(file);
                              if (error) {
                                setError(error);
                                e.target.value = '';
                                return;
                              }
                              
                              setValue('attachments.income_tax_return_file', file);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Financial Statements - Single file */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center mb-3">
                        <input
                          type="checkbox"
                          {...register('attachments.financial_statements')}
                          className="mr-3"
                        />
                        <span className="font-medium">Financial Statements (P&L and Balance sheet)</span>
                      </label>
                      <div className="ml-6">
                        {watch('attachments.financial_statements_file') && (
                          <div className="flex items-center justify-between bg-gray-50 p-2 rounded mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-700">{watch('attachments.financial_statements_file').name}</span>
                              {watch('attachments.financial_statements_file').id && (
                                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                  Uploaded
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {watch('attachments.financial_statements_file').id && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const fileId = watch('attachments.financial_statements_file').id;
                                      const response = await axios.get(`/api/attachments/download/${fileId}`, {
                                        responseType: 'blob'
                                      });
                                      
                                      // Get the content type from the response headers
                                      const contentType = response.headers['content-type'] || 'application/octet-stream';
                                      
                                      // Create blob with the correct MIME type
                                      const blob = new Blob([response.data], { type: contentType });
                                      const url = window.URL.createObjectURL(blob);
                                      window.open(url, '_blank');
                                      
                                      // Clean up the URL object after a delay
                                      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                                    } catch (error) {
                                      console.error('Error downloading file:', error);
                                      setError('Failed to download file');
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  View
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setValue('attachments.financial_statements_file', null)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                          className="text-sm"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              // Validate file size
                              const error = validateFileSize(file);
                              if (error) {
                                setError(error);
                                e.target.value = '';
                                return;
                              }
                              
                              setValue('attachments.financial_statements_file', file);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Cancelled Cheque - Single file */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center mb-3">
                        <input
                          type="checkbox"
                          {...register('attachments.cancelled_cheque')}
                          className="mr-3"
                        />
                        <span className="font-medium">Cancelled Cheque</span>
                      </label>
                      <div className="ml-6">
                        {watch('attachments.cancelled_cheque_file') && (
                          <div className="flex items-center justify-between bg-gray-50 p-2 rounded mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-700">{watch('attachments.cancelled_cheque_file').name}</span>
                              {watch('attachments.cancelled_cheque_file').id && (
                                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                  Uploaded
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {watch('attachments.cancelled_cheque_file').id && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const fileId = watch('attachments.cancelled_cheque_file').id;
                                      const response = await axios.get(`/api/attachments/download/${fileId}`, {
                                        responseType: 'blob'
                                      });
                                      
                                      // Get the content type from the response headers
                                      const contentType = response.headers['content-type'] || 'application/octet-stream';
                                      
                                      // Create blob with the correct MIME type
                                      const blob = new Blob([response.data], { type: contentType });
                                      const url = window.URL.createObjectURL(blob);
                                      window.open(url, '_blank');
                                      
                                      // Clean up the URL object after a delay
                                      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                                    } catch (error) {
                                      console.error('Error downloading file:', error);
                                      setError('Failed to download file');
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  View
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setValue('attachments.cancelled_cheque_file', null)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                          className="text-sm"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              // Validate file size
                              const error = validateFileSize(file);
                              if (error) {
                                setError(error);
                                e.target.value = '';
                                return;
                              }
                              
                              setValue('attachments.cancelled_cheque_file', file);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* PAN Card - Single file */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center mb-3">
                        <input
                          type="checkbox"
                          {...register('attachments.pan_card')}
                          className="mr-3"
                        />
                        <span className="font-medium">PAN Card</span>
                      </label>
                      <div className="ml-6">
                        {watch('attachments.pan_card_file') && (
                          <div className="flex items-center justify-between bg-gray-50 p-2 rounded mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-700">{watch('attachments.pan_card_file').name}</span>
                              {watch('attachments.pan_card_file').id && (
                                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                  Uploaded
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {watch('attachments.pan_card_file').id && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const fileId = watch('attachments.pan_card_file').id;
                                      const response = await axios.get(`/api/attachments/download/${fileId}`, {
                                        responseType: 'blob'
                                      });
                                      
                                      // Get the content type from the response headers
                                      const contentType = response.headers['content-type'] || 'application/octet-stream';
                                      
                                      // Create blob with the correct MIME type
                                      const blob = new Blob([response.data], { type: contentType });
                                      const url = window.URL.createObjectURL(blob);
                                      window.open(url, '_blank');
                                      
                                      // Clean up the URL object after a delay
                                      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                                    } catch (error) {
                                      console.error('Error downloading file:', error);
                                      setError('Failed to download file');
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  View
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setValue('attachments.pan_card_file', null)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                          className="text-sm"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              // Validate file size
                              const error = validateFileSize(file);
                              if (error) {
                                setError(error);
                                e.target.value = '';
                                return;
                              }
                              
                              setValue('attachments.pan_card_file', file);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Aadhar Card - Single file */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center mb-3">
                        <input
                          type="checkbox"
                          {...register('attachments.aadhar_card')}
                          className="mr-3"
                        />
                        <span className="font-medium">Aadhar Card</span>
                      </label>
                      <div className="ml-6">
                        {watch('attachments.aadhar_card_file') && (
                          <div className="flex items-center justify-between bg-gray-50 p-2 rounded mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-700">{watch('attachments.aadhar_card_file').name}</span>
                              {watch('attachments.aadhar_card_file').id && (
                                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                  Uploaded
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {watch('attachments.aadhar_card_file').id && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const fileId = watch('attachments.aadhar_card_file').id;
                                      const response = await axios.get(`/api/attachments/download/${fileId}`, {
                                        responseType: 'blob'
                                      });
                                      
                                      // Get the content type from the response headers
                                      const contentType = response.headers['content-type'] || 'application/octet-stream';
                                      
                                      // Create blob with the correct MIME type
                                      const blob = new Blob([response.data], { type: contentType });
                                      const url = window.URL.createObjectURL(blob);
                                      window.open(url, '_blank');
                                      
                                      // Clean up the URL object after a delay
                                      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                                    } catch (error) {
                                      console.error('Error downloading file:', error);
                                      setError('Failed to download file');
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  View
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setValue('attachments.aadhar_card_file', null)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                          className="text-sm"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              // Validate file size
                              const error = validateFileSize(file);
                              if (error) {
                                setError(error);
                                e.target.value = '';
                                return;
                              }
                              
                              setValue('attachments.aadhar_card_file', file);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Other Documents - Multiple files allowed */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <label className="flex items-center mb-3">
                        <input
                          type="checkbox"
                          {...register('attachments.other_documents')}
                          className="mr-3"
                        />
                        <span className="font-medium">Any other documents applicant/counselor may wish to attach</span>
                      </label>
                      <div className="ml-6 space-y-2">
                        {watch('attachments.other_documents_files')?.map((file, index) => (
                          <div key={file.id || index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-700">{file.name}</span>
                              {file.id && (
                                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                                  Uploaded
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {file.id && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const response = await axios.get(`/api/attachments/download/${file.id}`, {
                                        responseType: 'blob'
                                      });
                                      
                                      // Get the content type from the response headers
                                      const contentType = response.headers['content-type'] || 'application/octet-stream';
                                      
                                      // Create blob with the correct MIME type
                                      const blob = new Blob([response.data], { type: contentType });
                                      const url = window.URL.createObjectURL(blob);
                                      window.open(url, '_blank');
                                      
                                      // Clean up the URL object after a delay
                                      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                                    } catch (error) {
                                      console.error('Error downloading file:', error);
                                      setError('Failed to download file');
                                    }
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  View
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const files = watch('attachments.other_documents_files') || [];
                                  const newFiles = files.filter((_, i) => i !== index);
                                  setValue('attachments.other_documents_files', newFiles);
                                }}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center space-x-2">
                          <input
                            type="file"
                            multiple
                            accept="*/*"
                            className="text-sm"
                            onChange={(e) => {
                              const files = Array.from(e.target.files);
                              
                              // Validate file sizes
                              const invalidFiles = [];
                              files.forEach(file => {
                                const error = validateFileSize(file);
                                if (error) {
                                  invalidFiles.push(error);
                                }
                              });
                              
                              if (invalidFiles.length > 0) {
                                setError(invalidFiles.join('\n'));
                                e.target.value = '';
                                return;
                              }
                              
                              const existingFiles = watch('attachments.other_documents_files') || [];
                              setValue('attachments.other_documents_files', [...existingFiles, ...files]);
                              e.target.value = '';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.multiple = true;
                              input.accept = '*/*';
                              input.onchange = (e) => {
                                const files = Array.from(e.target.files);
                                
                                // Validate file sizes
                                const invalidFiles = [];
                                files.forEach(file => {
                                  const error = validateFileSize(file);
                                  if (error) {
                                    invalidFiles.push(error);
                                  }
                                });
                                
                                if (invalidFiles.length > 0) {
                                  setError(invalidFiles.join('\n'));
                                  return;
                                }
                                
                                const existingFiles = watch('attachments.other_documents_files') || [];
                                setValue('attachments.other_documents_files', [...existingFiles, ...files]);
                              };
                              input.click();
                            }}
                            className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSectionSaveAsDraft('attachments', watch('attachments'))}
                  disabled={saveSectionMutation.isLoading || uploadingFiles || !canUpdateSection('attachments')}
                  className={!canUpdateSection('attachments') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {uploadingFiles ? 'Uploading Files...' : (saveSectionMutation.isLoading ? 'Saving...' : 'Save as Draft')}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSectionSave('attachments', watch('attachments'))}
                  disabled={saveSectionMutation.isLoading || uploadingFiles || !canUpdateSection('attachments')}
                  className={!canUpdateSection('attachments') ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {uploadingFiles ? 'Uploading Files...' : (saveSectionMutation.isLoading ? 'Saving...' : 'Save')}
                </Button>
              </div>
            </div>
          )}

          {/* Workflow Comments for Attachments */}
          {activeTab === 'attachments' && canComment && (
            <WorkflowComments caseId={caseId} workflowStep="attachments" />
          )}
        </Card>

        <div className="flex justify-between mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/cases?search=${encodeURIComponent(formData?.form?.case_number || caseId || '')}`)}
          >
            Back to Cases
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || (formData?.form?.is_complete && formData?.form?.case_status !== 'welfare_rejected')}
          >
            {isSubmitting ? 'Saving...' : 'Save All Sections'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CounselingForm;