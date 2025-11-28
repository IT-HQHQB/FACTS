import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../utils/permissionUtils';
import { Card, Button, Input, Alert, Toast } from '../components/ui';

const CoverLetterForm = ({ caseId, isViewOnly = false, onSuccess, onExposeSubmit = null }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Check permissions
  const { hasPermission: hasCreate } = usePermission('cover_letter_forms', 'create');
  const { hasPermission: hasUpdate } = usePermission('cover_letter_forms', 'update');
  const { hasPermission: hasSubmit } = usePermission('cover_letter_forms', 'submit');
  const { hasPermission: hasRead } = usePermission('cover_letter_forms', 'read');
  
  const canEdit = !isViewOnly && (hasCreate || hasUpdate || user?.role === 'admin' || user?.role === 'super_admin');
  const canSubmit = hasSubmit || user?.role === 'admin' || user?.role === 'super_admin';
  
  // Form state
  const [formData, setFormData] = useState({
    applicant_details: {
      name: '',
      place: '',
      age: '',
      contact_number: '',
      case_id: '',
      its: ''
    },
    counsellor_details: {
      name: '',
      place: '',
      age: '',
      contact_number: '',
      certified: false,
      its: ''
    },
    financial_overview: {
      current_personal_income: '',
      current_family_income: '',
      earning_family_members: '',
      dependents: '',
      assets: {
        shop: false,
        house: false,
        gold: false,
        machinery: false,
        stock: false
      },
      liabilities: {
        qardan: false,
        den: false,
        others: false
      },
      business_name: '',
      business_year: '',
      industry_segment: '',
      present_occupation: ''
    },
    proposed_upliftment_plan: '',
    financial_assistance: {
      requested: {
        enayat_amount: '',
        qardan_amount: '',
        total_amount: ''
      },
      recommended: {
        enayat_amount: '',
        qardan_amount: '',
        total_amount: ''
      }
    },
    non_financial_assistance: '',
    projected_income: {
      applicant: {
        after_3_year: '',
        after_5_year: ''
      },
      family: {
        after_3_year: '',
        after_5_year: ''
      }
    },
    case_management_comments: '',
    executive_approval: {
      management_comments: '',
      approved_amounts: {
        enayat: '',
        qardan: '',
        total: ''
      },
      signatures: {
        coordinator: {
          signature: '',
          date: ''
        },
        case_management: {
          signature: '',
          date: ''
        },
        executive_management: {
          signature: '',
          date: ''
        }
      }
    }
  });

  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch existing form data
  const { data: formResponse, isLoading } = useQuery(
    ['coverLetterForm', caseId],
    () => axios.get(`/api/cover-letter-forms/case/${caseId}`).then(res => res.data),
    {
      enabled: !!caseId,
      retry: false,
      onSuccess: (data) => {
        if (data.form) {
          setFormData({
            applicant_details: data.form.applicant_details || formData.applicant_details,
            counsellor_details: data.form.counsellor_details || formData.counsellor_details,
            financial_overview: data.form.financial_overview || formData.financial_overview,
            proposed_upliftment_plan: data.form.proposed_upliftment_plan || '',
            financial_assistance: data.form.financial_assistance || formData.financial_assistance,
            non_financial_assistance: data.form.non_financial_assistance || '',
            projected_income: data.form.projected_income || formData.projected_income,
            case_management_comments: data.form.case_management_comments || '',
            executive_approval: data.form.executive_approval || formData.executive_approval
          });
        }
      }
    }
  );

  // Fetch case details to populate applicant info
  const { data: caseData } = useQuery(
    ['case', caseId],
    () => axios.get(`/api/cases/${caseId}`).then(res => res.data),
    {
      enabled: !!caseId && !formResponse?.form,
      retry: false,
      onSuccess: (data) => {
        if (data.case && !formResponse?.form) {
          setFormData(prev => ({
            ...prev,
            applicant_details: {
              ...prev.applicant_details,
              name: data.case.applicant_full_name || '',
              case_id: data.case.case_number || '',
              its: data.case.its_number || ''
            }
          }));
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
      onSuccess: () => {
        queryClient.invalidateQueries(['coverLetterForm', caseId]);
        queryClient.invalidateQueries(['cases']);
        setSuccessMessage('Cover letter form submitted successfully!');
        setTimeout(() => setSuccessMessage(''), 5000);
        if (onSuccess) onSuccess();
      },
      onError: (error) => {
        setErrors({ submit: error.response?.data?.error || 'Failed to submit form' });
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

  const handleSave = () => {
    setErrors({});
    saveMutation.mutate(formData);
  };

  const handleSubmit = () => {
    if (!formResponse?.form?.id) {
      setErrors({ submit: 'Please save the form before submitting' });
      return;
    }
    
    setErrors({});
    submitMutation.mutate(formResponse.form.id);
  };

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

      <div className="space-y-6">
        {/* Applicant Details Section */}
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Applicant Details</h3>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Name"
                value={formData.applicant_details.name}
                onChange={(e) => handleChange('applicant_details.name', e.target.value)}
                disabled={!canEdit}
              />
              <Input
                label="Place"
                value={formData.applicant_details.place}
                onChange={(e) => handleChange('applicant_details.place', e.target.value)}
                disabled={!canEdit}
              />
              <Input
                label="Age"
                type="number"
                value={formData.applicant_details.age}
                onChange={(e) => handleChange('applicant_details.age', e.target.value)}
                disabled={!canEdit}
              />
              <Input
                label="Contact Number"
                value={formData.applicant_details.contact_number}
                onChange={(e) => handleChange('applicant_details.contact_number', e.target.value)}
                disabled={!canEdit}
              />
              <Input
                label="Case Id"
                value={formData.applicant_details.case_id}
                onChange={(e) => handleChange('applicant_details.case_id', e.target.value)}
                disabled={!canEdit}
              />
              <Input
                label="ITS"
                value={formData.applicant_details.its}
                onChange={(e) => handleChange('applicant_details.its', e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </Card.Content>
        </Card>

        {/* Counsellor Details Section */}
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Counsellor Details</h3>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Name"
                value={formData.counsellor_details.name}
                onChange={(e) => handleChange('counsellor_details.name', e.target.value)}
                disabled={!canEdit}
              />
              <Input
                label="Place"
                value={formData.counsellor_details.place}
                onChange={(e) => handleChange('counsellor_details.place', e.target.value)}
                disabled={!canEdit}
              />
              <Input
                label="Age"
                type="number"
                value={formData.counsellor_details.age}
                onChange={(e) => handleChange('counsellor_details.age', e.target.value)}
                disabled={!canEdit}
              />
              <Input
                label="Contact Number"
                value={formData.counsellor_details.contact_number}
                onChange={(e) => handleChange('counsellor_details.contact_number', e.target.value)}
                disabled={!canEdit}
              />
              <Input
                label="ITS"
                value={formData.counsellor_details.its}
                onChange={(e) => handleChange('counsellor_details.its', e.target.value)}
                disabled={!canEdit}
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
                  value={formData.financial_overview.current_personal_income}
                  onChange={(e) => handleChange('financial_overview.current_personal_income', e.target.value)}
                  disabled={!canEdit}
                />
                <Input
                  label="Current Family Income (Rs)"
                  type="number"
                  value={formData.financial_overview.current_family_income}
                  onChange={(e) => handleChange('financial_overview.current_family_income', e.target.value)}
                  disabled={!canEdit}
                />
                <Input
                  label="Earning Family Members"
                  type="number"
                  value={formData.financial_overview.earning_family_members}
                  onChange={(e) => handleChange('financial_overview.earning_family_members', e.target.value)}
                  disabled={!canEdit}
                />
                <Input
                  label="Dependents"
                  type="number"
                  value={formData.financial_overview.dependents}
                  onChange={(e) => handleChange('financial_overview.dependents', e.target.value)}
                  disabled={!canEdit}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assets</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {['shop', 'house', 'gold', 'machinery', 'stock'].map(asset => (
                    <div key={asset} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`asset_${asset}`}
                        checked={formData.financial_overview.assets[asset]}
                        onChange={(e) => handleChange(`financial_overview.assets.${asset}`, e.target.checked)}
                        disabled={!canEdit}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <label htmlFor={`asset_${asset}`} className="text-sm text-gray-700 capitalize">
                        {asset}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Liabilities</label>
                <div className="grid grid-cols-3 gap-3">
                  {['qardan', 'den', 'others'].map(liability => (
                    <div key={liability} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`liability_${liability}`}
                        checked={formData.financial_overview.liabilities[liability]}
                        onChange={(e) => handleChange(`financial_overview.liabilities.${liability}`, e.target.checked)}
                        disabled={!canEdit}
                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                      />
                      <label htmlFor={`liability_${liability}`} className="text-sm text-gray-700 capitalize">
                        {liability}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Business Name & Year of Starting"
                  value={formData.financial_overview.business_name}
                  onChange={(e) => handleChange('financial_overview.business_name', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Business name and year"
                />
                <Input
                  label="Industry / Segment"
                  value={formData.financial_overview.industry_segment}
                  onChange={(e) => handleChange('financial_overview.industry_segment', e.target.value)}
                  disabled={!canEdit}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Present Occupation / Business
                </label>
                <textarea
                  value={formData.financial_overview.present_occupation}
                  onChange={(e) => handleChange('financial_overview.present_occupation', e.target.value)}
                  disabled={!canEdit}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                        value={formData.financial_assistance.requested.enayat_amount}
                        onChange={(e) => handleChange('financial_assistance.requested.enayat_amount', e.target.value)}
                        disabled={!canEdit}
                        className="border-0 p-0"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.financial_assistance.requested.qardan_amount}
                        onChange={(e) => handleChange('financial_assistance.requested.qardan_amount', e.target.value)}
                        disabled={!canEdit}
                        className="border-0 p-0"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.financial_assistance.requested.total_amount}
                        onChange={(e) => handleChange('financial_assistance.requested.total_amount', e.target.value)}
                        disabled={!canEdit}
                        className="border-0 p-0"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">Recommended</td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.financial_assistance.recommended.enayat_amount}
                        onChange={(e) => handleChange('financial_assistance.recommended.enayat_amount', e.target.value)}
                        disabled={!canEdit}
                        className="border-0 p-0"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.financial_assistance.recommended.qardan_amount}
                        onChange={(e) => handleChange('financial_assistance.recommended.qardan_amount', e.target.value)}
                        disabled={!canEdit}
                        className="border-0 p-0"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.financial_assistance.recommended.total_amount}
                        onChange={(e) => handleChange('financial_assistance.recommended.total_amount', e.target.value)}
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
                    <th className="border border-gray-300 px-4 py-2 text-left">After 3 year</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">After 5 year</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">Applicant</td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.projected_income.applicant.after_3_year}
                        onChange={(e) => handleChange('projected_income.applicant.after_3_year', e.target.value)}
                        disabled={!canEdit}
                        className="border-0 p-0"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.projected_income.applicant.after_5_year}
                        onChange={(e) => handleChange('projected_income.applicant.after_5_year', e.target.value)}
                        disabled={!canEdit}
                        className="border-0 p-0"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">Family</td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.projected_income.family.after_3_year}
                        onChange={(e) => handleChange('projected_income.family.after_3_year', e.target.value)}
                        disabled={!canEdit}
                        className="border-0 p-0"
                      />
                    </td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Input
                        type="number"
                        value={formData.projected_income.family.after_5_year}
                        onChange={(e) => handleChange('projected_income.family.after_5_year', e.target.value)}
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

        {/* Case Management Comments */}
        <Card>
          <Card.Header>
            <h3 className="text-lg font-semibold text-gray-900">Case Management Comments</h3>
          </Card.Header>
          <Card.Content>
            <textarea
              value={formData.case_management_comments}
              onChange={(e) => handleChange('case_management_comments', e.target.value)}
              disabled={!canEdit}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter case management comments..."
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Management Comments
                </label>
                <textarea
                  value={formData.executive_approval.management_comments}
                  onChange={(e) => handleChange('executive_approval.management_comments', e.target.value)}
                  disabled={!canEdit || (user?.role !== 'Executive Management' && user?.role !== 'admin' && user?.role !== 'super_admin')}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter management comments..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Approved Amounts</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Enayat"
                    type="number"
                    value={formData.executive_approval.approved_amounts.enayat}
                    onChange={(e) => handleChange('executive_approval.approved_amounts.enayat', e.target.value)}
                    disabled={!canEdit || (user?.role !== 'Executive Management' && user?.role !== 'admin' && user?.role !== 'super_admin')}
                  />
                  <Input
                    label="Qardan"
                    type="number"
                    value={formData.executive_approval.approved_amounts.qardan}
                    onChange={(e) => handleChange('executive_approval.approved_amounts.qardan', e.target.value)}
                    disabled={!canEdit || (user?.role !== 'Executive Management' && user?.role !== 'admin' && user?.role !== 'super_admin')}
                  />
                  <Input
                    label="Total"
                    type="number"
                    value={formData.executive_approval.approved_amounts.total}
                    onChange={(e) => handleChange('executive_approval.approved_amounts.total', e.target.value)}
                    disabled={!canEdit || (user?.role !== 'Executive Management' && user?.role !== 'admin' && user?.role !== 'super_admin')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Co-ordinator</label>
                  <Input
                    label="Signature"
                    value={formData.executive_approval.signatures.coordinator.signature}
                    onChange={(e) => handleChange('executive_approval.signatures.coordinator.signature', e.target.value)}
                    disabled={!canEdit}
                  />
                  <Input
                    label="Date"
                    type="date"
                    value={formData.executive_approval.signatures.coordinator.date}
                    onChange={(e) => handleChange('executive_approval.signatures.coordinator.date', e.target.value)}
                    disabled={!canEdit}
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Case Management</label>
                  <Input
                    label="Signature"
                    value={formData.executive_approval.signatures.case_management.signature}
                    onChange={(e) => handleChange('executive_approval.signatures.case_management.signature', e.target.value)}
                    disabled={!canEdit}
                  />
                  <Input
                    label="Date"
                    type="date"
                    value={formData.executive_approval.signatures.case_management.date}
                    onChange={(e) => handleChange('executive_approval.signatures.case_management.date', e.target.value)}
                    disabled={!canEdit}
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Executive Management</label>
                  <Input
                    label="Signature"
                    value={formData.executive_approval.signatures.executive_management.signature}
                    onChange={(e) => handleChange('executive_approval.signatures.executive_management.signature', e.target.value)}
                    disabled={!canEdit || (user?.role !== 'Executive Management' && user?.role !== 'admin' && user?.role !== 'super_admin')}
                  />
                  <Input
                    label="Date"
                    type="date"
                    value={formData.executive_approval.signatures.executive_management.date}
                    onChange={(e) => handleChange('executive_approval.signatures.executive_management.date', e.target.value)}
                    disabled={!canEdit || (user?.role !== 'Executive Management' && user?.role !== 'admin' && user?.role !== 'super_admin')}
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
            {canSubmit && existingForm?.id && (
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

