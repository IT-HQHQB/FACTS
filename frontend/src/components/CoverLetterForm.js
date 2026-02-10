import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../utils/permissionUtils';
import { Card, Button, Input, Alert, Toast } from '../components/ui';
import SignaturePad from './SignaturePad';
import { generateCoverLetterPDF } from '../utils/generateCoverLetterPDF';

const CoverLetterForm = ({ caseId, isViewOnly = false, onSuccess, onExposeSubmit = null }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Check permissions
  const { hasPermission: hasCreate } = usePermission('cover_letter_forms', 'create');
  const { hasPermission: hasUpdate } = usePermission('cover_letter_forms', 'update');
  const { hasPermission: hasSubmit } = usePermission('cover_letter_forms', 'submit');
  const { hasPermission: hasRead } = usePermission('cover_letter_forms', 'read');
  
  // Form state
  const [formData, setFormData] = useState({
    applicant_details: {
      name: '',
      jamiat: '',
      jamaat: '',
      age: '',
      contact_number: '',
      case_id: '',
      its: ''
    },
    counsellor_details: {
      name: '',
      jamiat: '',
      jamaat: '',
      age: '',
      contact_number: '',
      certified: false,
      its: ''
    },
    // Individual financial fields
      current_personal_income: '',
      current_family_income: '',
      earning_family_members: '',
      dependents: '',
    // Individual asset fields
    asset_house: '',
    asset_shop: '',
    asset_gold: '',
    asset_machinery: '',
    asset_stock: '',
    // Individual liability fields
    liability_qardan: '',
    liability_den: '',
    liability_others: '',
    // Individual business fields
      business_name: '',
      industry_segment: '',
    present_occupation: '',
    // Individual financial assistance fields
    requested_enayat: '',
    requested_qardan: '',
    requested_total: '',
    recommended_enayat: '',
    recommended_qardan: '',
    recommended_total: '',
    proposed_upliftment_plan: '',
    non_financial_assistance: '',
    // Individual projected income fields for applicant
    applicant_projected_income_after_1_year: '',
    applicant_projected_income_after_2_years: '',
    applicant_projected_income_after_3_years: '',
    applicant_projected_income_after_4_years: '',
    applicant_projected_income_after_5_years: '',
    // Individual projected income fields for family
    family_projected_income_after_1_year: '',
    family_projected_income_after_2_years: '',
    family_projected_income_after_3_years: '',
    family_projected_income_after_4_years: '',
    family_projected_income_after_5_years: '',
    welfare_department_comments: '',
    // Individual approved amounts fields
    approved_enayat: '',
    approved_qardan: '',
    approved_qh_months: '',
    // Individual signature fields for Welfare Department
    welfare_department_its: '',
    welfare_department_name: '',
    welfare_department_signature_type: 'draw',
    welfare_department_signature_file_path: '',
    welfare_department_signature_drawing_data: '',
    welfare_department_date: '',
    // Individual signature fields for Zonal In-charge
    zonal_incharge_its: '',
    zonal_incharge_name: '',
    zonal_incharge_signature_type: 'draw',
    zonal_incharge_signature_file_path: '',
    zonal_incharge_signature_drawing_data: '',
    zonal_incharge_date: '',
    // Individual signature fields for Operations Head
    operations_head_its: '',
    operations_head_name: '',
    operations_head_signature_type: 'draw',
    operations_head_signature_file_path: '',
    operations_head_signature_drawing_data: '',
    operations_head_date: ''
  });

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [applicantPhotoPreview, setApplicantPhotoPreview] = useState(null);
  const [counsellorPhotoPreview, setCounsellorPhotoPreview] = useState(null);

  // Helper function to convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  // Fetch existing form data
  const { data: formResponse, isLoading } = useQuery(
    ['coverLetterForm', caseId],
    () => axios.get(`/api/cover-letter-forms/case/${caseId}`).then(res => res.data),
    {
      enabled: !!caseId,
      retry: false,
      onSuccess: (data) => {
        if (data.form) {
          // Handle individual fields (new format) - check if individual fields exist
          if ('applicant_name' in data.form || 'counsellor_name' in data.form) {
            setFormData(prev => ({
              ...prev,
              applicant_details: {
                name: data.form.applicant_name || '',
                jamiat: data.form.applicant_jamiat || '',
                jamaat: data.form.applicant_jamaat || '',
                age: data.form.applicant_age || '',
                contact_number: data.form.applicant_contact_number || '',
                case_id: data.form.applicant_case_id || '',
                its: data.form.applicant_its || '',
                photo: data.form.applicant_photo || null
              },
              counsellor_details: {
                name: data.form.counsellor_name || '',
                jamiat: data.form.counsellor_jamiat || '',
                jamaat: data.form.counsellor_jamaat || '',
                age: data.form.counsellor_age || '',
                contact_number: data.form.counsellor_contact_number || '',
                its: data.form.counsellor_its || '',
                certified: data.form.counsellor_certified || false,
                photo: data.form.counsellor_photo || null
              },
              // Individual financial fields
              current_personal_income: data.form.current_personal_income !== null && data.form.current_personal_income !== undefined 
                ? String(data.form.current_personal_income) 
                : (prev.current_personal_income || ''),
              current_family_income: data.form.current_family_income !== null && data.form.current_family_income !== undefined 
                ? String(data.form.current_family_income) 
                : (prev.current_family_income || ''),
              earning_family_members: data.form.earning_family_members !== null && data.form.earning_family_members !== undefined 
                ? String(data.form.earning_family_members) 
                : (prev.earning_family_members || ''),
              dependents: data.form.dependents !== null && data.form.dependents !== undefined 
                ? String(data.form.dependents) 
                : (prev.dependents || ''),
              // Individual asset fields
              asset_house: data.form.asset_house !== null && data.form.asset_house !== undefined 
                ? String(data.form.asset_house) 
                : (prev.asset_house || ''),
              asset_shop: data.form.asset_shop !== null && data.form.asset_shop !== undefined 
                ? String(data.form.asset_shop) 
                : (prev.asset_shop || ''),
              asset_gold: data.form.asset_gold !== null && data.form.asset_gold !== undefined 
                ? String(data.form.asset_gold) 
                : (prev.asset_gold || ''),
              asset_machinery: data.form.asset_machinery !== null && data.form.asset_machinery !== undefined 
                ? String(data.form.asset_machinery) 
                : (prev.asset_machinery || ''),
              asset_stock: data.form.asset_stock !== null && data.form.asset_stock !== undefined 
                ? String(data.form.asset_stock) 
                : (prev.asset_stock || ''),
              // Individual liability fields
              liability_qardan: data.form.liability_qardan !== null && data.form.liability_qardan !== undefined 
                ? String(data.form.liability_qardan) 
                : (prev.liability_qardan || ''),
              liability_den: data.form.liability_den !== null && data.form.liability_den !== undefined 
                ? String(data.form.liability_den) 
                : (prev.liability_den || ''),
              liability_others: data.form.liability_others !== null && data.form.liability_others !== undefined 
                ? String(data.form.liability_others) 
                : (prev.liability_others || ''),
              // Individual business fields
              business_name: data.form.business_name !== null && data.form.business_name !== undefined 
                ? String(data.form.business_name) 
                : (prev.business_name || ''),
              industry_segment: data.form.industry_segment !== null && data.form.industry_segment !== undefined 
                ? String(data.form.industry_segment) 
                : (prev.industry_segment || ''),
              present_occupation: data.form.present_occupation !== null && data.form.present_occupation !== undefined 
                ? String(data.form.present_occupation) 
                : (prev.present_occupation || ''),
              // Individual financial assistance fields
              requested_enayat: data.form.requested_enayat !== null && data.form.requested_enayat !== undefined 
                ? String(data.form.requested_enayat) 
                : (prev.requested_enayat || ''),
              requested_qardan: data.form.requested_qardan !== null && data.form.requested_qardan !== undefined 
                ? String(data.form.requested_qardan) 
                : (prev.requested_qardan || ''),
              requested_total: (() => {
                // Calculate total from enayat and qardan if both are present
                const enayat = data.form.requested_enayat !== null && data.form.requested_enayat !== undefined 
                  ? parseFloat(data.form.requested_enayat) || 0 
                  : 0;
                const qardan = data.form.requested_qardan !== null && data.form.requested_qardan !== undefined 
                  ? parseFloat(data.form.requested_qardan) || 0 
                  : 0;
                // Use calculated total if enayat or qardan exists, otherwise use stored total
                if (enayat > 0 || qardan > 0) {
                  return String(enayat + qardan);
                }
                return data.form.requested_total !== null && data.form.requested_total !== undefined 
                  ? String(data.form.requested_total) 
                  : (prev.requested_total || '');
              })(),
              recommended_enayat: data.form.recommended_enayat !== null && data.form.recommended_enayat !== undefined 
                ? String(data.form.recommended_enayat) 
                : (prev.recommended_enayat || ''),
              recommended_qardan: data.form.recommended_qardan !== null && data.form.recommended_qardan !== undefined 
                ? String(data.form.recommended_qardan) 
                : (prev.recommended_qardan || ''),
              recommended_total: (() => {
                // Calculate total from enayat and qardan if both are present
                const enayat = data.form.recommended_enayat !== null && data.form.recommended_enayat !== undefined 
                  ? parseFloat(data.form.recommended_enayat) || 0 
                  : 0;
                const qardan = data.form.recommended_qardan !== null && data.form.recommended_qardan !== undefined 
                  ? parseFloat(data.form.recommended_qardan) || 0 
                  : 0;
                // Use calculated total if enayat or qardan exists, otherwise use stored total
                if (enayat > 0 || qardan > 0) {
                  return String(enayat + qardan);
                }
                return data.form.recommended_total !== null && data.form.recommended_total !== undefined 
                  ? String(data.form.recommended_total) 
                  : (prev.recommended_total || '');
              })(),
              // Individual projected income fields for applicant
              applicant_projected_income_after_1_year: data.form.applicant_projected_income_after_1_year !== null && data.form.applicant_projected_income_after_1_year !== undefined 
                ? String(data.form.applicant_projected_income_after_1_year) 
                : (prev.applicant_projected_income_after_1_year || ''),
              applicant_projected_income_after_2_years: data.form.applicant_projected_income_after_2_years !== null && data.form.applicant_projected_income_after_2_years !== undefined 
                ? String(data.form.applicant_projected_income_after_2_years) 
                : (prev.applicant_projected_income_after_2_years || ''),
              applicant_projected_income_after_3_years: data.form.applicant_projected_income_after_3_years !== null && data.form.applicant_projected_income_after_3_years !== undefined 
                ? String(data.form.applicant_projected_income_after_3_years) 
                : (prev.applicant_projected_income_after_3_years || ''),
              applicant_projected_income_after_4_years: data.form.applicant_projected_income_after_4_years !== null && data.form.applicant_projected_income_after_4_years !== undefined 
                ? String(data.form.applicant_projected_income_after_4_years) 
                : (prev.applicant_projected_income_after_4_years || ''),
              applicant_projected_income_after_5_years: data.form.applicant_projected_income_after_5_years !== null && data.form.applicant_projected_income_after_5_years !== undefined 
                ? String(data.form.applicant_projected_income_after_5_years) 
                : (prev.applicant_projected_income_after_5_years || ''),
              // Individual projected income fields for family
              family_projected_income_after_1_year: data.form.family_projected_income_after_1_year !== null && data.form.family_projected_income_after_1_year !== undefined 
                ? String(data.form.family_projected_income_after_1_year) 
                : (prev.family_projected_income_after_1_year || ''),
              family_projected_income_after_2_years: data.form.family_projected_income_after_2_years !== null && data.form.family_projected_income_after_2_years !== undefined 
                ? String(data.form.family_projected_income_after_2_years) 
                : (prev.family_projected_income_after_2_years || ''),
              family_projected_income_after_3_years: data.form.family_projected_income_after_3_years !== null && data.form.family_projected_income_after_3_years !== undefined 
                ? String(data.form.family_projected_income_after_3_years) 
                : (prev.family_projected_income_after_3_years || ''),
              family_projected_income_after_4_years: data.form.family_projected_income_after_4_years !== null && data.form.family_projected_income_after_4_years !== undefined 
                ? String(data.form.family_projected_income_after_4_years) 
                : (prev.family_projected_income_after_4_years || ''),
              family_projected_income_after_5_years: data.form.family_projected_income_after_5_years !== null && data.form.family_projected_income_after_5_years !== undefined 
                ? String(data.form.family_projected_income_after_5_years) 
                : (prev.family_projected_income_after_5_years || ''),
            proposed_upliftment_plan: data.form.proposed_upliftment_plan || '',
            non_financial_assistance: data.form.non_financial_assistance || '',
              welfare_department_comments: data.form.welfare_department_comments || '',
              // Individual approved amounts fields
              approved_enayat: data.form.approved_enayat !== null && data.form.approved_enayat !== undefined 
                ? String(data.form.approved_enayat) 
                : (prev.approved_enayat || ''),
              approved_qardan: data.form.approved_qardan !== null && data.form.approved_qardan !== undefined 
                ? String(data.form.approved_qardan) 
                : (prev.approved_qardan || ''),
              approved_qh_months: data.form.approved_qh_months !== null && data.form.approved_qh_months !== undefined 
                ? String(data.form.approved_qh_months) 
                : (prev.approved_qh_months || ''),
              // Individual signature fields for Welfare Department
              welfare_department_its: data.form.welfare_department_its || prev.welfare_department_its || '',
              welfare_department_name: data.form.welfare_department_name || prev.welfare_department_name || '',
              welfare_department_signature_type: data.form.welfare_department_signature_type || prev.welfare_department_signature_type || 'draw',
              welfare_department_signature_file_path: data.form.welfare_department_signature_file_path || prev.welfare_department_signature_file_path || '',
              welfare_department_signature_drawing_data: data.form.welfare_department_signature_drawing_data || prev.welfare_department_signature_drawing_data || '',
              welfare_department_date: data.form.welfare_department_date && data.form.welfare_department_date !== null ? String(data.form.welfare_department_date) : (prev.welfare_department_date || ''),
              // Individual signature fields for Zonal In-charge
              zonal_incharge_its: data.form.zonal_incharge_its || prev.zonal_incharge_its || '',
              zonal_incharge_name: data.form.zonal_incharge_name || prev.zonal_incharge_name || '',
              zonal_incharge_signature_type: data.form.zonal_incharge_signature_type || prev.zonal_incharge_signature_type || 'draw',
              zonal_incharge_signature_file_path: data.form.zonal_incharge_signature_file_path || prev.zonal_incharge_signature_file_path || '',
              zonal_incharge_signature_drawing_data: data.form.zonal_incharge_signature_drawing_data || prev.zonal_incharge_signature_drawing_data || '',
              zonal_incharge_date: data.form.zonal_incharge_date && data.form.zonal_incharge_date !== null ? String(data.form.zonal_incharge_date) : (prev.zonal_incharge_date || ''),
              // Individual signature fields for Operations Head
              operations_head_its: data.form.operations_head_its || prev.operations_head_its || '',
              operations_head_name: data.form.operations_head_name || prev.operations_head_name || '',
              operations_head_signature_type: data.form.operations_head_signature_type || prev.operations_head_signature_type || 'draw',
              operations_head_signature_file_path: data.form.operations_head_signature_file_path || prev.operations_head_signature_file_path || '',
              operations_head_signature_drawing_data: data.form.operations_head_signature_drawing_data || prev.operations_head_signature_drawing_data || '',
              operations_head_date: data.form.operations_head_date && data.form.operations_head_date !== null ? String(data.form.operations_head_date) : (prev.operations_head_date || '')
            }));
            // Set photo previews
            if (data.form.applicant_photo) {
              setApplicantPhotoPreview(data.form.applicant_photo);
            }
            if (data.form.counsellor_photo) {
              setCounsellorPhotoPreview(data.form.counsellor_photo);
            }
          }
        } else if (data.applicantData || data.counselorData || data.familyFinancialData || data.familyAssetsLiabilitiesData || data.personalOccupationData || data.financialAssistanceTotals) {
          // Auto-populate from fetched data when form doesn't exist
          setFormData(prev => ({
            ...prev,
            applicant_details: {
              ...prev.applicant_details,
              name: data.applicantData?.name || prev.applicant_details.name,
              jamiat: data.applicantData?.jamiat || prev.applicant_details.jamiat,
              jamaat: data.applicantData?.jamaat || prev.applicant_details.jamaat,
              age: data.applicantData?.age || prev.applicant_details.age,
              contact_number: data.applicantData?.contact_number || prev.applicant_details.contact_number,
              its: data.applicantData?.its || prev.applicant_details.its,
              case_id: data.applicantData?.case_id || prev.applicant_details.case_id,
              photo: data.applicantData?.photo || prev.applicant_details.photo
            },
            counsellor_details: {
              ...prev.counsellor_details,
              name: data.counselorData?.name || prev.counsellor_details.name,
              jamiat: data.counselorData?.jamiat || prev.counsellor_details.jamiat,
              jamaat: data.counselorData?.jamaat || prev.counsellor_details.jamaat,
              contact_number: data.counselorData?.contact_number || prev.counsellor_details.contact_number,
              its: data.counselorData?.its || prev.counsellor_details.its,
              photo: data.counselorData?.photo || prev.counsellor_details.photo
            },
            // Auto-populate financial fields from family data
            current_personal_income: data.familyFinancialData?.current_personal_income !== null && data.familyFinancialData?.current_personal_income !== undefined
              ? String(data.familyFinancialData.current_personal_income)
              : prev.current_personal_income,
            current_family_income: data.familyFinancialData?.current_family_income !== null && data.familyFinancialData?.current_family_income !== undefined
              ? String(data.familyFinancialData.current_family_income)
              : prev.current_family_income,
            earning_family_members: data.familyFinancialData?.earning_family_members !== null && data.familyFinancialData?.earning_family_members !== undefined
              ? String(data.familyFinancialData.earning_family_members)
              : prev.earning_family_members,
            dependents: data.familyFinancialData?.dependents !== null && data.familyFinancialData?.dependents !== undefined
              ? String(data.familyFinancialData.dependents)
              : prev.dependents,
            // Auto-populate assets and liabilities from family data
            asset_house: data.familyAssetsLiabilitiesData?.asset_house !== null && data.familyAssetsLiabilitiesData?.asset_house !== undefined
              ? String(data.familyAssetsLiabilitiesData.asset_house)
              : prev.asset_house,
            asset_shop: data.familyAssetsLiabilitiesData?.asset_shop !== null && data.familyAssetsLiabilitiesData?.asset_shop !== undefined
              ? String(data.familyAssetsLiabilitiesData.asset_shop)
              : prev.asset_shop,
            asset_gold: data.familyAssetsLiabilitiesData?.asset_gold !== null && data.familyAssetsLiabilitiesData?.asset_gold !== undefined
              ? String(data.familyAssetsLiabilitiesData.asset_gold)
              : prev.asset_gold,
            asset_machinery: data.familyAssetsLiabilitiesData?.asset_machinery !== null && data.familyAssetsLiabilitiesData?.asset_machinery !== undefined
              ? String(data.familyAssetsLiabilitiesData.asset_machinery)
              : prev.asset_machinery,
            asset_stock: data.familyAssetsLiabilitiesData?.asset_stock !== null && data.familyAssetsLiabilitiesData?.asset_stock !== undefined
              ? String(data.familyAssetsLiabilitiesData.asset_stock)
              : prev.asset_stock,
            liability_qardan: data.familyAssetsLiabilitiesData?.liability_qardan !== null && data.familyAssetsLiabilitiesData?.liability_qardan !== undefined
              ? String(data.familyAssetsLiabilitiesData.liability_qardan)
              : prev.liability_qardan,
            liability_den: data.familyAssetsLiabilitiesData?.liability_den !== null && data.familyAssetsLiabilitiesData?.liability_den !== undefined
              ? String(data.familyAssetsLiabilitiesData.liability_den)
              : prev.liability_den,
            liability_others: data.familyAssetsLiabilitiesData?.liability_others !== null && data.familyAssetsLiabilitiesData?.liability_others !== undefined
              ? String(data.familyAssetsLiabilitiesData.liability_others)
              : prev.liability_others,
            // Auto-populate business fields from personal details
            present_occupation: data.personalOccupationData !== null && data.personalOccupationData !== undefined
              ? String(data.personalOccupationData)
              : prev.present_occupation,
            // Auto-populate financial assistance requested fields from timeline_assistance totals
            requested_enayat: data.financialAssistanceTotals?.total_enayat !== null && data.financialAssistanceTotals?.total_enayat !== undefined
              ? String(data.financialAssistanceTotals.total_enayat)
              : prev.requested_enayat,
            requested_qardan: data.financialAssistanceTotals?.total_qardan !== null && data.financialAssistanceTotals?.total_qardan !== undefined
              ? String(data.financialAssistanceTotals.total_qardan)
              : prev.requested_qardan,
            requested_total: (data.financialAssistanceTotals?.total_enayat !== null && data.financialAssistanceTotals?.total_qardan !== null)
              ? String((parseFloat(data.financialAssistanceTotals.total_enayat) || 0) + (parseFloat(data.financialAssistanceTotals.total_qardan) || 0))
              : prev.requested_total,
            // Auto-populate projected income from economic growth profit data
            applicant_projected_income_after_1_year: data.economicGrowthProfit?.profit_year1 !== null && data.economicGrowthProfit?.profit_year1 !== undefined
              ? String(data.economicGrowthProfit.profit_year1)
              : prev.applicant_projected_income_after_1_year,
            applicant_projected_income_after_2_years: data.economicGrowthProfit?.profit_year2 !== null && data.economicGrowthProfit?.profit_year2 !== undefined
              ? String(data.economicGrowthProfit.profit_year2)
              : prev.applicant_projected_income_after_2_years,
            applicant_projected_income_after_3_years: data.economicGrowthProfit?.profit_year3 !== null && data.economicGrowthProfit?.profit_year3 !== undefined
              ? String(data.economicGrowthProfit.profit_year3)
              : prev.applicant_projected_income_after_3_years,
            applicant_projected_income_after_4_years: data.economicGrowthProfit?.profit_year4 !== null && data.economicGrowthProfit?.profit_year4 !== undefined
              ? String(data.economicGrowthProfit.profit_year4)
              : prev.applicant_projected_income_after_4_years,
            applicant_projected_income_after_5_years: data.economicGrowthProfit?.profit_year5 !== null && data.economicGrowthProfit?.profit_year5 !== undefined
              ? String(data.economicGrowthProfit.profit_year5)
              : prev.applicant_projected_income_after_5_years
            // Family projected income fields are user-entered only - do NOT auto-populate
          }));
          // Set photo previews
          if (data.applicantData?.photo) {
            setApplicantPhotoPreview(data.applicantData.photo);
          }
          if (data.counselorData?.photo) {
            setCounsellorPhotoPreview(data.counselorData.photo);
          }
        }
      }
    }
  );

  // Fetch case details to populate applicant info (fallback if form endpoint doesn't return auto-fetch data)
  const { data: caseData } = useQuery(
    ['case', caseId],
    () => axios.get(`/api/cases/${caseId}`).then(res => res.data),
    {
      enabled: !!caseId && !formResponse?.form && !formResponse?.applicantData,
      retry: false,
      onSuccess: (data) => {
        if (data.case && !formResponse?.form && !formResponse?.applicantData) {
          setFormData(prev => ({
            ...prev,
            applicant_details: {
              ...prev.applicant_details,
              name: data.case.applicant_full_name || data.case.full_name || prev.applicant_details.name,
              age: data.case.age || prev.applicant_details.age,
              contact_number: data.case.phone || prev.applicant_details.contact_number,
              case_id: data.case.case_number || prev.applicant_details.case_id,
              its: data.case.its_number || prev.applicant_details.its,
              photo: data.case.photo || prev.applicant_details.photo
            },
            counsellor_details: {
              ...prev.counsellor_details,
              name: data.case.counselor_full_name || prev.counsellor_details.name,
              contact_number: data.case.counselor_phone || data.case.counselor_email || prev.counsellor_details.contact_number,
              photo: data.case.counselor_photo || prev.counsellor_details.photo
            }
          }));
          // Set photo previews
          if (data.case.photo) {
            setApplicantPhotoPreview(data.case.photo);
          }
          if (data.case.counselor_photo) {
            setCounsellorPhotoPreview(data.case.counselor_photo);
          }
        }
      }
    }
  );

  // Save mutation
  const saveMutation = useMutation(
    async (data) => {
      return axios.post(`/api/cover-letter-forms/case/${caseId}`, data);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['coverLetterForm', caseId]);
        setSuccessMessage('Cover letter form saved successfully!');
        setTimeout(() => setSuccessMessage(''), 5000);
        if (onSuccess) onSuccess();
      },
      onError: (error) => {
        setErrors({ submit: error.response?.data?.error || 'Failed to save form' });
      }
    }
  );

  // Submit mutation
  const submitMutation = useMutation(
    async (formId) => {
      return axios.put(`/api/cover-letter-forms/${formId}/submit`);
    },
    {
      onSuccess: async () => {
        queryClient.invalidateQueries(['coverLetterForm', caseId]);
        queryClient.invalidateQueries(['cases']);
        setSuccessMessage('Cover letter form submitted successfully!');
        setTimeout(() => setSuccessMessage(''), 5000);
        
        // Generate PDF after successful submission
        // Get case number - try multiple sources (declare outside try for error handling)
        let caseNumber = '';
        if (formResponse?.case_number) {
          caseNumber = formResponse.case_number;
        } else if (caseData?.case?.case_number) {
          caseNumber = caseData.case.case_number;
        } else if (formData.applicant_details?.case_id) {
          caseNumber = formData.applicant_details.case_id;
        }
        
        const userName = user?.full_name || user?.username || user?.name || 'System';
        
        try {
          // Generate PDF
          const pdfDoc = await generateCoverLetterPDF(formData, {
            caseNumber,
            userName,
            caseId
          });
          
          // Generate blob and download
          const pdfBlob = pdfDoc.output('blob');
          
          if (!pdfBlob || pdfBlob.size === 0) {
            throw new Error('PDF blob is empty');
          }
          
          const pdfUrl = URL.createObjectURL(pdfBlob);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const fileName = `cover_letter_${caseNumber || caseId || 'unknown'}_${timestamp}.pdf`;
          
          // Trigger download
          const link = document.createElement('a');
          link.href = pdfUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Open in new tab
          const newWindow = window.open(pdfUrl, '_blank');
          if (!newWindow) {
            setErrors(prev => ({
              ...prev,
              pdf: 'PDF generated but popup was blocked. Please check your browser settings.'
            }));
          }
          
          // Clean up blob URL after a delay
          setTimeout(() => {
            URL.revokeObjectURL(pdfUrl);
          }, 100);
        } catch (pdfError) {
          console.error('Error generating PDF:', pdfError);
          // Show error message to user
          setErrors(prev => ({
            ...prev,
            pdf: `PDF generation failed: ${pdfError.message}. Form was submitted successfully.`
          }));
          // Also show as a toast/alert
          setSuccessMessage(`Form submitted successfully, but PDF generation failed: ${pdfError.message}`);
        }
        
        if (onSuccess) onSuccess();
      },
      onError: (error) => {
        setErrors({ submit: error.response?.data?.error || error.message || 'Failed to submit form' });
      }
    }
  );

  const handleChange = (path, value) => {
    setFormData(prev => {
      const keys = path.split('.');
      const newData = { ...prev };
      let current = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      
      // Auto-calculate totals for financial assistance
      if (path === 'requested_enayat' || path === 'requested_qardan') {
        // Get the updated values after setting the new value
        const enayat = parseFloat(path === 'requested_enayat' ? value : newData.requested_enayat) || 0;
        const qardan = parseFloat(path === 'requested_qardan' ? value : newData.requested_qardan) || 0;
        newData.requested_total = String(enayat + qardan);
      }
      if (path === 'recommended_enayat' || path === 'recommended_qardan') {
        // Get the updated values after setting the new value
        const enayat = parseFloat(path === 'recommended_enayat' ? value : newData.recommended_enayat) || 0;
        const qardan = parseFloat(path === 'recommended_qardan' ? value : newData.recommended_qardan) || 0;
        newData.recommended_total = String(enayat + qardan);
      }
      
      return newData;
    });
    
    // Clear error for this field
    if (errors[path]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[path];
        return newErrors;
      });
    }
  };

  // Handle applicant photo upload
  const handleApplicantPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors({ applicant_photo: 'Please select an image file' });
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrors({ applicant_photo: 'Image size must be less than 5MB' });
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      handleChange('applicant_details.photo', base64);
      setApplicantPhotoPreview(base64);
      if (errors.applicant_photo) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.applicant_photo;
          return newErrors;
        });
      }
    } catch (error) {
      setErrors({ applicant_photo: 'Failed to process image' });
    }
  };

  // Handle counselor photo upload
  const handleCounsellorPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors({ counsellor_photo: 'Please select an image file' });
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrors({ counsellor_photo: 'Image size must be less than 5MB' });
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      handleChange('counsellor_details.photo', base64);
      setCounsellorPhotoPreview(base64);
      if (errors.counsellor_photo) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.counsellor_photo;
          return newErrors;
        });
      }
    } catch (error) {
      setErrors({ counsellor_photo: 'Failed to process image' });
    }
  };

  // Remove applicant photo
  const handleRemoveApplicantPhoto = () => {
    handleChange('applicant_details.photo', null);
    setApplicantPhotoPreview(null);
  };

  // Remove counselor photo
  const handleRemoveCounsellorPhoto = () => {
    handleChange('counsellor_details.photo', null);
    setCounsellorPhotoPreview(null);
  };

  // Handle ITS number change and auto-fetch name
  const handleITSChange = async (itsNumber, role) => {
    // Update ITS field
    handleChange(`${role}_its`, itsNumber);

    // Clear name if ITS is empty
    if (!itsNumber || itsNumber.trim() === '') {
      handleChange(`${role}_name`, '');
      return;
    }

    // Validate ITS format (8 digits)
    const trimmedITS = itsNumber.trim();
    if (!/^\d{8}$/.test(trimmedITS)) {
      // Don't fetch if format is invalid, but don't show error yet (wait for blur)
      return;
    }

    try {
      // Fetch name from API
      const response = await axios.get(`/api/applicants/fetch-from-api/${trimmedITS}`);
      
      if (response.data && response.data.data) {
        // API returns data with full_name field
        const name = response.data.data.full_name || response.data.data.name || '';
        if (name) {
          handleChange(`${role}_name`, name);
        }
      }
    } catch (error) {
      console.error(`Error fetching name for ITS ${trimmedITS}:`, error);
      // Don't show error to user, just log it
      // Name field will remain empty or show existing value
    }
  };

  // Handle signature file upload
  const handleSignatureFileUpload = async (e, rolePrefix) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors({ [`${rolePrefix}_signature`]: 'Please select an image file' });
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrors({ [`${rolePrefix}_signature`]: 'Image size must be less than 5MB' });
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      handleChange(`${rolePrefix}_signature_type`, 'upload');
      handleChange(`${rolePrefix}_signature_file_path`, base64);
      handleChange(`${rolePrefix}_signature_drawing_data`, ''); // Clear drawing data when uploading
      if (errors[`${rolePrefix}_signature`]) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[`${rolePrefix}_signature`];
          return newErrors;
        });
      }
    } catch (error) {
      setErrors({ [`${rolePrefix}_signature`]: 'Failed to process image' });
    }
  };

  const handleSave = () => {
    setErrors({});
    
    // Convert form data to flat structure with individual fields
    const saveData = {
      // Individual applicant fields
      applicant_name: formData.applicant_details.name || null,
      applicant_jamiat: formData.applicant_details.jamiat || null,
      applicant_jamaat: formData.applicant_details.jamaat || null,
      applicant_age: formData.applicant_details.age || null,
      applicant_contact_number: formData.applicant_details.contact_number || null,
      applicant_case_id: formData.applicant_details.case_id || null,
      applicant_its: formData.applicant_details.its || null,
      applicant_photo: formData.applicant_details.photo || null,
      // Individual counselor fields
      counsellor_name: formData.counsellor_details.name || null,
      counsellor_jamiat: formData.counsellor_details.jamiat || null,
      counsellor_jamaat: formData.counsellor_details.jamaat || null,
      counsellor_age: formData.counsellor_details.age || null,
      counsellor_contact_number: formData.counsellor_details.contact_number || null,
      counsellor_its: formData.counsellor_details.its || null,
      counsellor_certified: formData.counsellor_details.certified || false,
      counsellor_photo: formData.counsellor_details.photo || null,
      // Individual financial fields
      current_personal_income: formData.current_personal_income || null,
      current_family_income: formData.current_family_income || null,
      earning_family_members: formData.earning_family_members || null,
      dependents: formData.dependents || null,
      // Individual asset fields
      asset_house: formData.asset_house || null,
      asset_shop: formData.asset_shop || null,
      asset_gold: formData.asset_gold || null,
      asset_machinery: formData.asset_machinery || null,
      asset_stock: formData.asset_stock || null,
      // Individual liability fields
      liability_qardan: formData.liability_qardan || null,
      liability_den: formData.liability_den || null,
      liability_others: formData.liability_others || null,
      // Individual business fields
      business_name: formData.business_name || null,
      industry_segment: formData.industry_segment || null,
      present_occupation: formData.present_occupation || null,
      // Individual financial assistance fields
      requested_enayat: formData.requested_enayat || null,
      requested_qardan: formData.requested_qardan || null,
      recommended_enayat: formData.recommended_enayat || null,
      recommended_qardan: formData.recommended_qardan || null,
      // Individual projected income fields
      applicant_projected_income_after_1_year: formData.applicant_projected_income_after_1_year || null,
      applicant_projected_income_after_2_years: formData.applicant_projected_income_after_2_years || null,
      applicant_projected_income_after_3_years: formData.applicant_projected_income_after_3_years || null,
      applicant_projected_income_after_4_years: formData.applicant_projected_income_after_4_years || null,
      applicant_projected_income_after_5_years: formData.applicant_projected_income_after_5_years || null,
      family_projected_income_after_1_year: formData.family_projected_income_after_1_year || null,
      family_projected_income_after_2_years: formData.family_projected_income_after_2_years || null,
      family_projected_income_after_3_years: formData.family_projected_income_after_3_years || null,
      family_projected_income_after_4_years: formData.family_projected_income_after_4_years || null,
      family_projected_income_after_5_years: formData.family_projected_income_after_5_years || null,
      proposed_upliftment_plan: formData.proposed_upliftment_plan,
      non_financial_assistance: formData.non_financial_assistance,
      welfare_department_comments: formData.welfare_department_comments,
      // Individual approved amounts fields
      approved_enayat: formData.approved_enayat || null,
      approved_qardan: formData.approved_qardan || null,
      approved_qh_months: formData.approved_qh_months || null,
      // Individual signature fields for Welfare Department
      welfare_department_its: formData.welfare_department_its || null,
      welfare_department_name: formData.welfare_department_name || null,
      welfare_department_signature_type: formData.welfare_department_signature_type || null,
      welfare_department_signature_file_path: formData.welfare_department_signature_file_path || null,
      welfare_department_signature_drawing_data: formData.welfare_department_signature_drawing_data || null,
      welfare_department_date: formData.welfare_department_date || null,
      // Individual signature fields for Zonal In-charge
      zonal_incharge_its: formData.zonal_incharge_its || null,
      zonal_incharge_name: formData.zonal_incharge_name || null,
      zonal_incharge_signature_type: formData.zonal_incharge_signature_type || null,
      zonal_incharge_signature_file_path: formData.zonal_incharge_signature_file_path || null,
      zonal_incharge_signature_drawing_data: formData.zonal_incharge_signature_drawing_data || null,
      zonal_incharge_date: formData.zonal_incharge_date || null,
      // Individual signature fields for Operations Head
      operations_head_its: formData.operations_head_its || null,
      operations_head_name: formData.operations_head_name || null,
      operations_head_signature_type: formData.operations_head_signature_type || null,
      operations_head_signature_file_path: formData.operations_head_signature_file_path || null,
      operations_head_signature_drawing_data: formData.operations_head_signature_drawing_data || null,
      operations_head_date: formData.operations_head_date || null
    };
    
    saveMutation.mutate(saveData);
  };

  const handleSubmit = () => {
    if (!formResponse?.form?.id) {
      setErrors({ submit: 'Please save the form before submitting' });
      return;
    }
    
    setErrors({});
    submitMutation.mutate(formResponse.form.id);
  };

  // Check if form is approved (but super_admin can always edit)
  // Note: formResponse is from useQuery above, so it's available here
  const isFormApproved = formResponse?.form?.is_approved || false;
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  
  const canSubmit = hasSubmit || user?.role === 'admin' || isSuperAdmin;

  // Expose submit handler to parent
  useEffect(() => {
    if (onExposeSubmit) {
      onExposeSubmit({
        submit: handleSubmit,
        canSubmit: canSubmit && formResponse?.form?.id,
        isSubmitting: submitMutation.isLoading
      });
    }
  }, [handleSubmit, canSubmit, formResponse?.form?.id, submitMutation.isLoading, onExposeSubmit]);

  if (isLoading) {
    return (
      <Card>
        <Card.Content>
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        </Card.Content>
      </Card>
    );
  }

  const existingForm = formResponse?.form;
  
  // Determine if user can edit based on form existence and permissions
  // If form exists, user needs update permission (or admin/super_admin)
  // If form doesn't exist, user needs create permission (or admin/super_admin)
  // IMPORTANT: Check role-based access first to avoid issues with async permission loading
  const hasEditPermission = existingForm 
    ? (isSuperAdmin || isAdmin || hasUpdate)  // For existing forms, check update permission
    : (isSuperAdmin || isAdmin || hasCreate); // For new forms, check create permission
  
  // Form can be edited if:
  // 1. Not in view-only mode
  // 2. User has appropriate permission (create for new forms, update for existing forms) OR is admin/super_admin
  // 3. Form is not approved OR user is super_admin
  // NOTE: Form remains editable after submission (is_complete = true) until approval (is_approved = true)
  const canEdit = !isViewOnly && 
                  hasEditPermission &&
                  (!isFormApproved || isSuperAdmin);

  return (
    <>
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <Toast 
            severity="success" 
            onClose={() => setSuccessMessage('')}
            autoClose={true}
            duration={5000}
          >
            {successMessage}
          </Toast>
        </div>
      )}

      {/* Approval Status Indicator */}
      {isFormApproved && (
        <Alert 
          severity={isSuperAdmin ? "info" : "warning"}
          className="mb-4"
        >
          {isSuperAdmin 
            ? "This cover letter has been approved. You have super admin privileges to edit."
            : "This cover letter has been approved and cannot be edited."
          }
        </Alert>
      )}

      <div className="space-y-6">
        {/* Applicant Details Section */}
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Applicant Details</h3>
          </Card.Header>
          <Card.Content>
            <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Name"
                value={formData.applicant_details.name}
                onChange={(e) => handleChange('applicant_details.name', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
              />
              <Input
                  label="Jamiat"
                  value={formData.applicant_details.jamiat}
                  onChange={(e) => handleChange('applicant_details.jamiat', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
                />
                <Input
                  label="Jamaat"
                  value={formData.applicant_details.jamaat}
                  onChange={(e) => handleChange('applicant_details.jamaat', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
              />
              <Input
                label="Age"
                type="number"
                value={formData.applicant_details.age}
                onChange={(e) => handleChange('applicant_details.age', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
              />
              <Input
                label="Contact Number"
                value={formData.applicant_details.contact_number}
                onChange={(e) => handleChange('applicant_details.contact_number', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
              />
              <Input
                label="Case Id"
                value={formData.applicant_details.case_id}
                onChange={(e) => handleChange('applicant_details.case_id', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
              />
              <Input
                label="ITS"
                value={formData.applicant_details.its}
                onChange={(e) => handleChange('applicant_details.its', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
                />
              </div>
              
              {/* Applicant Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Applicant Photo
                </label>
                <div className="flex items-start space-x-4">
                  {applicantPhotoPreview && (
                    <div className="relative">
                      <img
                        src={applicantPhotoPreview}
                        alt="Applicant"
                        className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                      />
                      {canEdit && (
                        <button
                          type="button"
                          onClick={handleRemoveApplicantPhoto}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )}
                  {canEdit && (
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleApplicantPhotoChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                      />
                      {errors.applicant_photo && (
                        <p className="mt-1 text-sm text-red-600">{errors.applicant_photo}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">Max file size: 5MB</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* Counsellor Details Section */}
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Counsellor Details</h3>
          </Card.Header>
          <Card.Content>
            <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Name"
                value={formData.counsellor_details.name}
                onChange={(e) => handleChange('counsellor_details.name', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
              />
              <Input
                  label="Jamiat"
                  value={formData.counsellor_details.jamiat}
                  onChange={(e) => handleChange('counsellor_details.jamiat', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
                />
                <Input
                  label="Jamaat"
                  value={formData.counsellor_details.jamaat}
                  onChange={(e) => handleChange('counsellor_details.jamaat', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
              />
              <Input
                label="Age"
                type="number"
                value={formData.counsellor_details.age}
                onChange={(e) => handleChange('counsellor_details.age', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
              />
              <Input
                label="Contact Number"
                value={formData.counsellor_details.contact_number}
                onChange={(e) => handleChange('counsellor_details.contact_number', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
              />
              <Input
                label="ITS"
                value={formData.counsellor_details.its}
                onChange={(e) => handleChange('counsellor_details.its', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
              />
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="certified"
                  checked={formData.counsellor_details.certified}
                  onChange={(e => handleChange('counsellor_details.certified', e.target.checked))}
                  disabled={!canEdit}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="certified" className="text-sm font-medium text-gray-700">
                  Certified
                </label>
                </div>
              </div>
              
              {/* Counsellor Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Counsellor Photo
                </label>
                <div className="flex items-start space-x-4">
                  {counsellorPhotoPreview && (
                    <div className="relative">
                      <img
                        src={counsellorPhotoPreview}
                        alt="Counsellor"
                        className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                      />
                      {canEdit && (
                        <button
                          type="button"
                          onClick={handleRemoveCounsellorPhoto}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )}
                  {canEdit && (
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCounsellorPhotoChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                      />
                      {errors.counsellor_photo && (
                        <p className="mt-1 text-sm text-red-600">{errors.counsellor_photo}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">Max file size: 5MB</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* Financial and Business Overview Section */}
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Financial and Business Overview</h3>
          </Card.Header>
          <Card.Content>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Current Personal Income (Rs)"
                  type="number"
                  value={formData.current_personal_income}
                  onChange={(e) => handleChange('current_personal_income', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
                />
                <Input
                  label="Current Family Income (Rs)"
                  type="number"
                  value={formData.current_family_income}
                  onChange={(e) => handleChange('current_family_income', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
                />
                <Input
                  label="Earning Family Members"
                  type="number"
                  value={formData.earning_family_members}
                  onChange={(e) => handleChange('earning_family_members', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
                />
                <Input
                  label="Dependents"
                  type="number"
                  value={formData.dependents}
                  onChange={(e) => handleChange('dependents', e.target.value)}
                  disabled={true}
                  className="bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assets</label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Input
                    label="House"
                    type="text"
                    value={formData.asset_house}
                    onChange={(e) => handleChange('asset_house', e.target.value)}
                    disabled={true}
                    className="bg-gray-50"
                  />
                  <Input
                    label="Shop"
                    type="text"
                    value={formData.asset_shop}
                    onChange={(e) => handleChange('asset_shop', e.target.value)}
                    disabled={true}
                    className="bg-gray-50"
                  />
                  <Input
                    label="Gold"
                    type="text"
                    value={formData.asset_gold}
                    onChange={(e) => handleChange('asset_gold', e.target.value)}
                    disabled={true}
                    className="bg-gray-50"
                  />
                  <Input
                    label="Machinery"
                    type="text"
                    value={formData.asset_machinery}
                    onChange={(e) => handleChange('asset_machinery', e.target.value)}
                    disabled={true}
                    className="bg-gray-50"
                  />
                  <Input
                    label="Stock"
                    type="text"
                    value={formData.asset_stock}
                    onChange={(e) => handleChange('asset_stock', e.target.value)}
                    disabled={true}
                    className="bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Liabilities</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Qardan (Rs)"
                    type="number"
                    value={formData.liability_qardan}
                    onChange={(e) => handleChange('liability_qardan', e.target.value)}
                    disabled={true}
                    className="bg-gray-50"
                  />
                  <Input
                    label="Den (Rs)"
                    type="number"
                    value={formData.liability_den}
                    onChange={(e) => handleChange('liability_den', e.target.value)}
                    disabled={true}
                    className="bg-gray-50"
                  />
                  <Input
                    label="Others (Rs)"
                    type="number"
                    value={formData.liability_others}
                    onChange={(e) => handleChange('liability_others', e.target.value)}
                    disabled={true}
                    className="bg-gray-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Business Name & Year of Starting"
                  value={formData.business_name}
                  onChange={(e) => handleChange('business_name', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Business name and year"
                />
                <Input
                  label="Industry / Segment"
                  value={formData.industry_segment}
                  onChange={(e) => handleChange('industry_segment', e.target.value)}
                  disabled={!canEdit}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Present Occupation / Business
                </label>
                <textarea
                  value={formData.present_occupation}
                  onChange={(e) => handleChange('present_occupation', e.target.value)}
                  disabled={true}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50 cursor-not-allowed"
                  placeholder="Products / Services, revenue, etc."
                />
              </div>
            </div>
          </Card.Content>
        </Card>

        {/* Summary of Proposed Upliftment Plan */}
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Summary of Proposed Upliftment Plan</h3>
          </Card.Header>
          <Card.Content>
            <textarea
              value={formData.proposed_upliftment_plan}
              onChange={(e) => handleChange('proposed_upliftment_plan', e.target.value)}
              disabled={!canEdit}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter the proposed upliftment plan..."
            />
          </Card.Content>
        </Card>

        {/* Financial Assistance */}
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Financial Assistance</h3>
          </Card.Header>
          <Card.Content>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left"></th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Enayat Amount</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Qardan Amount</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">Requested</td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.requested_enayat}
                        onChange={(e) => handleChange('requested_enayat', e.target.value)}
                        disabled={true}
                        className="border-0 p-0 bg-gray-50"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.requested_qardan}
                        onChange={(e) => handleChange('requested_qardan', e.target.value)}
                        disabled={true}
                        className="border-0 p-0 bg-gray-50"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.requested_total}
                        onChange={() => {}} // Read-only, calculated automatically
                        disabled={true}
                        className="border-0 p-0 bg-gray-50"
                        readOnly
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">Recommended</td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.recommended_enayat}
                        onChange={(e) => handleChange('recommended_enayat', e.target.value)}
                        disabled={!canEdit}
                        className="border-0 p-0"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.recommended_qardan}
                        onChange={(e) => handleChange('recommended_qardan', e.target.value)}
                        disabled={!canEdit}
                        className="border-0 p-0"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.recommended_total}
                        onChange={() => {}} // Read-only, calculated automatically
                        disabled={true}
                        className="border-0 p-0 bg-gray-50"
                        readOnly
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card.Content>
        </Card>

        {/* Non-financial Assistance */}
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Non-financial Assistance</h3>
          </Card.Header>
          <Card.Content>
            <textarea
              value={formData.non_financial_assistance}
              onChange={(e) => handleChange('non_financial_assistance', e.target.value)}
              disabled={!canEdit}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter non-financial assistance details..."
            />
          </Card.Content>
        </Card>

        {/* Projected Income */}
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Projected Income</h3>
          </Card.Header>
          <Card.Content>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left"></th>
                    <th className="border border-gray-300 px-4 py-2 text-left">After 1 year</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">After 2 years</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">After 3 years</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">After 4 years</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">After 5 years</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">Applicant</td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.applicant_projected_income_after_1_year}
                        onChange={(e) => handleChange('applicant_projected_income_after_1_year', e.target.value)}
                        disabled={true}
                        className="border-0 p-0 bg-gray-50"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.applicant_projected_income_after_2_years}
                        onChange={(e) => handleChange('applicant_projected_income_after_2_years', e.target.value)}
                        disabled={true}
                        className="border-0 p-0 bg-gray-50"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.applicant_projected_income_after_3_years}
                        onChange={(e) => handleChange('applicant_projected_income_after_3_years', e.target.value)}
                        disabled={true}
                        className="border-0 p-0 bg-gray-50"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.applicant_projected_income_after_4_years}
                        onChange={(e) => handleChange('applicant_projected_income_after_4_years', e.target.value)}
                        disabled={true}
                        className="border-0 p-0 bg-gray-50"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.applicant_projected_income_after_5_years}
                        onChange={(e) => handleChange('applicant_projected_income_after_5_years', e.target.value)}
                        disabled={true}
                        className="border-0 p-0 bg-gray-50"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">Family</td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.family_projected_income_after_1_year}
                        onChange={(e) => handleChange('family_projected_income_after_1_year', e.target.value)}
                        disabled={!canEdit}
                        className="border-0 p-0"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.family_projected_income_after_2_years}
                        onChange={(e) => handleChange('family_projected_income_after_2_years', e.target.value)}
                        disabled={!canEdit}
                        className="border-0 p-0"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.family_projected_income_after_3_years}
                        onChange={(e) => handleChange('family_projected_income_after_3_years', e.target.value)}
                        disabled={!canEdit}
                        className="border-0 p-0"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.family_projected_income_after_4_years}
                        onChange={(e) => handleChange('family_projected_income_after_4_years', e.target.value)}
                        disabled={!canEdit}
                        className="border-0 p-0"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.family_projected_income_after_5_years}
                        onChange={(e) => handleChange('family_projected_income_after_5_years', e.target.value)}
                        disabled={!canEdit}
                        className="border-0 p-0"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card.Content>
        </Card>

        {/* Welfare Department Comments */}
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Welfare Department Comments</h3>
          </Card.Header>
          <Card.Content>
            <textarea
              value={formData.welfare_department_comments}
              onChange={(e) => handleChange('welfare_department_comments', e.target.value)}
              disabled={!canEdit}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter comments..."
            />
          </Card.Content>
        </Card>

        {/* Executive Approval Section */}
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900 text-red-600">Executive Approval</h3>
          </Card.Header>
          <Card.Content>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Approved Amounts</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Enayat"
                    type="number"
                    value={formData.approved_enayat}
                    onChange={(e) => handleChange('approved_enayat', e.target.value)}
                    disabled={!canEdit}
                  />
                  <Input
                    label="Qardan"
                    type="number"
                    value={formData.approved_qardan}
                    onChange={(e) => handleChange('approved_qardan', e.target.value)}
                    disabled={!canEdit}
                  />
                  <Input
                    label="QH Months"
                    type="number"
                    value={formData.approved_qh_months}
                    onChange={(e) => handleChange('approved_qh_months', e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Welfare Department */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Welfare Department</label>
                  <Input
                    label="ITS"
                    value={formData.welfare_department_its}
                    onChange={(e) => handleITSChange(e.target.value, 'welfare_department')}
                    onBlur={(e) => {
                      const itsNumber = e.target.value.trim();
                      if (itsNumber && /^\d{8}$/.test(itsNumber)) {
                        handleITSChange(itsNumber, 'welfare_department');
                      }
                    }}
                    disabled={!canEdit}
                    className="mb-2"
                  />
                  <Input
                    label="Name"
                    value={formData.welfare_department_name}
                    onChange={(e) => handleChange('welfare_department_name', e.target.value)}
                    disabled={true}
                    className="bg-gray-50"
                  />
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Signature</label>
                    <div className="mb-2">
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="welfare_department_signature_type"
                            value="draw"
                            checked={formData.welfare_department_signature_type === 'draw'}
                            onChange={(e) => {
                              handleChange('welfare_department_signature_type', 'draw');
                              handleChange('welfare_department_signature_file_path', '');
                            }}
                            disabled={!canEdit}
                            className="mr-2"
                          />
                          <span className="text-sm">Draw Signature</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="welfare_department_signature_type"
                            value="upload"
                            checked={formData.welfare_department_signature_type === 'upload'}
                            onChange={(e) => {
                              handleChange('welfare_department_signature_type', 'upload');
                              handleChange('welfare_department_signature_drawing_data', '');
                            }}
                            disabled={!canEdit}
                            className="mr-2"
                          />
                          <span className="text-sm">Upload Signature</span>
                        </label>
                      </div>
                    </div>
                    {formData.welfare_department_signature_type === 'draw' ? (
                      <SignaturePad
                        value={formData.welfare_department_signature_drawing_data}
                        onChange={(value) => handleChange('welfare_department_signature_drawing_data', value)}
                        error={errors.welfare_department_signature}
                      />
                    ) : (
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleSignatureFileUpload(e, 'welfare_department')}
                          disabled={!canEdit}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                        />
                        {formData.welfare_department_signature_file_path && (
                          <div className="mt-2">
                            <img
                              src={formData.welfare_department_signature_file_path}
                              alt="Uploaded signature"
                              className="max-w-full h-24 border border-gray-300 rounded"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                handleChange('welfare_department_signature_file_path', '');
                              }}
                              disabled={!canEdit}
                              className="mt-1 text-sm text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <Input
                    label="Date"
                    type="date"
                    value={formData.welfare_department_date}
                    onChange={(e) => handleChange('welfare_department_date', e.target.value)}
                    disabled={!canEdit}
                    className="mt-2"
                  />
                </div>

                {/* Zonal In-charge */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Zonal In-charge</label>
                  <Input
                    label="ITS"
                    value={formData.zonal_incharge_its}
                    onChange={(e) => handleITSChange(e.target.value, 'zonal_incharge')}
                    onBlur={(e) => {
                      const itsNumber = e.target.value.trim();
                      if (itsNumber && /^\d{8}$/.test(itsNumber)) {
                        handleITSChange(itsNumber, 'zonal_incharge');
                      }
                    }}
                    disabled={!canEdit}
                    className="mb-2"
                  />
                  <Input
                    label="Name"
                    value={formData.zonal_incharge_name}
                    onChange={(e) => handleChange('zonal_incharge_name', e.target.value)}
                    disabled={true}
                    className="bg-gray-50"
                  />
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Signature</label>
                    <div className="mb-2">
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="zonal_incharge_signature_type"
                            value="draw"
                            checked={formData.zonal_incharge_signature_type === 'draw'}
                            onChange={(e) => {
                              handleChange('zonal_incharge_signature_type', 'draw');
                              handleChange('zonal_incharge_signature_file_path', '');
                            }}
                            disabled={!canEdit}
                            className="mr-2"
                          />
                          <span className="text-sm">Draw Signature</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="zonal_incharge_signature_type"
                            value="upload"
                            checked={formData.zonal_incharge_signature_type === 'upload'}
                            onChange={(e) => {
                              handleChange('zonal_incharge_signature_type', 'upload');
                              handleChange('zonal_incharge_signature_drawing_data', '');
                            }}
                            disabled={!canEdit}
                            className="mr-2"
                          />
                          <span className="text-sm">Upload Signature</span>
                        </label>
                      </div>
                    </div>
                    {formData.zonal_incharge_signature_type === 'draw' ? (
                      <SignaturePad
                        value={formData.zonal_incharge_signature_drawing_data}
                        onChange={(value) => handleChange('zonal_incharge_signature_drawing_data', value)}
                        error={errors.zonal_incharge_signature}
                      />
                    ) : (
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleSignatureFileUpload(e, 'zonal_incharge')}
                          disabled={!canEdit}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                        />
                        {formData.zonal_incharge_signature_file_path && (
                          <div className="mt-2">
                            <img
                              src={formData.zonal_incharge_signature_file_path}
                              alt="Uploaded signature"
                              className="max-w-full h-24 border border-gray-300 rounded"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                handleChange('zonal_incharge_signature_file_path', '');
                              }}
                              disabled={!canEdit}
                              className="mt-1 text-sm text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <Input
                    label="Date"
                    type="date"
                    value={formData.zonal_incharge_date}
                    onChange={(e) => handleChange('zonal_incharge_date', e.target.value)}
                    disabled={!canEdit}
                    className="mt-2"
                  />
                </div>

                {/* Operations Head */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Operations Head</label>
                  <Input
                    label="ITS"
                    value={formData.operations_head_its}
                    onChange={(e) => handleITSChange(e.target.value, 'operations_head')}
                    onBlur={(e) => {
                      const itsNumber = e.target.value.trim();
                      if (itsNumber && /^\d{8}$/.test(itsNumber)) {
                        handleITSChange(itsNumber, 'operations_head');
                      }
                    }}
                    disabled={!canEdit}
                    className="mb-2"
                  />
                  <Input
                    label="Name"
                    value={formData.operations_head_name}
                    onChange={(e) => handleChange('operations_head_name', e.target.value)}
                    disabled={true}
                    className="bg-gray-50"
                  />
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Signature</label>
                    <div className="mb-2">
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="operations_head_signature_type"
                            value="draw"
                            checked={formData.operations_head_signature_type === 'draw'}
                            onChange={(e) => {
                              handleChange('operations_head_signature_type', 'draw');
                              handleChange('operations_head_signature_file_path', '');
                            }}
                            disabled={!canEdit}
                            className="mr-2"
                          />
                          <span className="text-sm">Draw Signature</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="operations_head_signature_type"
                            value="upload"
                            checked={formData.operations_head_signature_type === 'upload'}
                            onChange={(e) => {
                              handleChange('operations_head_signature_type', 'upload');
                              handleChange('operations_head_signature_drawing_data', '');
                            }}
                            disabled={!canEdit}
                            className="mr-2"
                          />
                          <span className="text-sm">Upload Signature</span>
                        </label>
                      </div>
                    </div>
                    {formData.operations_head_signature_type === 'draw' ? (
                      <SignaturePad
                        value={formData.operations_head_signature_drawing_data}
                        onChange={(value) => handleChange('operations_head_signature_drawing_data', value)}
                        error={errors.operations_head_signature}
                      />
                    ) : (
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleSignatureFileUpload(e, 'operations_head')}
                          disabled={!canEdit}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                        />
                        {formData.operations_head_signature_file_path && (
                          <div className="mt-2">
                            <img
                              src={formData.operations_head_signature_file_path}
                              alt="Uploaded signature"
                              className="max-w-full h-24 border border-gray-300 rounded"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                handleChange('operations_head_signature_file_path', '');
                              }}
                              disabled={!canEdit}
                              className="mt-1 text-sm text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <Input
                    label="Date"
                    type="date"
                    value={formData.operations_head_date}
                    onChange={(e) => handleChange('operations_head_date', e.target.value)}
                    disabled={!canEdit}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>

        {errors.submit && (
          <Alert severity="error">{errors.submit}</Alert>
        )}

        {canEdit && (
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={handleSave}
              loading={saveMutation.isLoading}
            >
              Save
            </Button>
            {canSubmit && existingForm?.id && !isFormApproved && (
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={submitMutation.isLoading}
              >
                Submit
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default CoverLetterForm;

