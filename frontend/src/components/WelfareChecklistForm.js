import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../utils/permissionUtils';
import { Card, Button, Alert, Input, Chip, Toast } from '../components/ui';

const WelfareChecklistForm = ({ caseId, isViewOnly = false, onSuccess, caseStatus = null, onExposeSubmit = null }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Check permissions for welfare checklist
  const { hasPermission: hasWelfareChecklistCreate } = usePermission('welfare_checklist', 'create');
  const { hasPermission: hasWelfareChecklistUpdate } = usePermission('welfare_checklist', 'update');
  const { hasPermission: hasWelfareChecklistAll } = usePermission('welfare_checklist', 'all');
  const [responses, setResponses] = useState({});
  const [overallRemarks, setOverallRemarks] = useState('');
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  
  // Determine if checklist should be view-only based on case status
  // If case is approved (welfare_approved or beyond), make it view-only
  const isCaseApproved = caseStatus === 'welfare_approved' || 
                         caseStatus?.startsWith('submitted_to_executive') ||
                         caseStatus === 'executive_approved' ||
                         caseStatus === 'executive_rejected' ||
                         caseStatus === 'finance_disbursement' ||
                         caseStatus === 'completed' ||
                         caseStatus === 'closed';
  
  const effectiveViewOnly = isViewOnly || isCaseApproved;

  // Fetch grouped checklist items
  const { data: checklistData, isLoading: checklistLoading } = useQuery(
    ['welfareChecklistGrouped'],
    () => axios.get('/api/welfare-checklist/items/grouped').then(res => res.data),
    {
      enabled: !!caseId,
      retry: false,
    }
  );

  // Fetch existing responses for this case
  const { data: responsesData, isLoading: responsesLoading } = useQuery(
    ['welfareChecklistResponses', caseId],
    () => axios.get(`/api/welfare-checklist/responses/${caseId}`).then(res => res.data),
    {
      enabled: !!caseId,
      retry: false,
    }
  );

  // Fetch checklist status
  const { data: statusData } = useQuery(
    ['welfareChecklistStatus', caseId],
    () => axios.get(`/api/welfare-checklist/status/${caseId}`).then(res => res.data),
    {
      enabled: !!caseId,
      retry: false,
    }
  );

  // Initialize responses from existing data
  useEffect(() => {
    if (responsesData?.responses) {
      const existingResponses = {};
      responsesData.responses.forEach(response => {
        existingResponses[response.checklist_item_id] = {
          properly_filled: response.properly_filled,
          comments: response.comments || ''
        };
      });
      setResponses(existingResponses);
    }
    // Load overall remarks if available
    if (responsesData?.overall_remarks) {
      setOverallRemarks(responsesData.overall_remarks);
    }
  }, [responsesData]);

  // Submit checklist mutation
  const submitMutation = useMutation(
    async (data) => {
      return axios.post(`/api/welfare-checklist/responses/${caseId}`, data);
    },
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries(['welfareChecklistResponses', caseId]);
        queryClient.invalidateQueries(['welfareChecklistStatus', caseId]);
        queryClient.invalidateQueries(['case', caseId]);
        queryClient.invalidateQueries(['cases']); // Invalidate cases list to refresh status
        setErrors({});
        // Show success message
        setSuccessMessage(response?.data?.message || 'Checklist submitted successfully!');
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccessMessage('');
        }, 5000);
        if (onSuccess) {
          onSuccess();
        }
      },
      onError: (error) => {
        setErrors({ submit: error.response?.data?.error || 'Failed to submit checklist' });
      }
    }
  );

  const handleResponseChange = (itemId, field, value) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
    // Clear error for this item
    if (errors[itemId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[itemId];
        return newErrors;
      });
    }
  };

  const handleSubmit = useCallback(() => {
    setErrors({});
    
    // Validate all items have responses and comments when Y is selected
    const missingItems = [];
    const missingComments = [];
    
    checklistData?.grouped?.forEach(category => {
      category.items.forEach(item => {
        const itemResponse = responses[item.id];
        
        // Check if Y/N is selected
        if (!itemResponse?.properly_filled) {
          missingItems.push(item.id);
          setErrors(prev => ({
            ...prev,
            [item.id]: 'Please select Y or N'
          }));
        }
        
        // If Y is selected, comments are mandatory
        if (itemResponse?.properly_filled === 'Y' && (!itemResponse.comments || itemResponse.comments.trim() === '')) {
          missingComments.push(item.id);
          setErrors(prev => ({
            ...prev,
            [item.id]: 'Comments are required when "Y" (Yes) is selected'
          }));
        }
      });
    });

    if (missingItems.length > 0 || missingComments.length > 0) {
      const errorMsg = missingItems.length > 0 
        ? 'Please fill all checklist items before submitting'
        : 'Please add comments for all items marked as "Y" (Yes)';
      setErrors({ submit: errorMsg });
      return;
    }

    // Prepare responses array
    const responsesArray = [];
    checklistData?.grouped?.forEach(category => {
      category.items.forEach(item => {
        responsesArray.push({
          checklist_item_id: item.id,
          properly_filled: responses[item.id].properly_filled,
          comments: responses[item.id].comments || ''
        });
      });
    });

    submitMutation.mutate({
      responses: responsesArray,
      overall_remarks: overallRemarks
    });
  }, [checklistData, responses, overallRemarks, submitMutation]);

  const grouped = checklistData?.grouped || [];
  
  // Calculate real-time completion status from responses state
  const calculateCompletionStatus = () => {
    let total = 0;
    let filled = 0;
    
    grouped.forEach(category => {
      category.items.forEach(item => {
        total++;
        if (responses[item.id]?.properly_filled) {
          filled++;
        }
      });
    });
    
    return {
      total,
      filled,
      isComplete: total > 0 && filled === total,
      completionPercentage: total > 0 ? Math.round((filled / total) * 100) : 0
    };
  };
  
  const completionStatus = calculateCompletionStatus();
  
  // Check if user can submit based on permissions or roles
  // User can submit if they have create/update/all permissions OR if they have welfare role (case-insensitive)
  const userRole = user?.role?.toLowerCase();
  const hasWelfareRole = userRole === 'welfare_reviewer' || userRole === 'welfare' || userRole === 'admin' || userRole === 'super_admin';
  const canSubmitChecklist = !effectiveViewOnly && (hasWelfareChecklistCreate || hasWelfareChecklistUpdate || hasWelfareChecklistAll || hasWelfareRole || user?.role === 'admin' || user?.role === 'super_admin');
  
  // Expose submit handler to parent component - MUST be before any early returns
  useEffect(() => {
    if (onExposeSubmit) {
      onExposeSubmit({
        submit: handleSubmit,
        canSubmit: canSubmitChecklist,
        isSubmitting: submitMutation.isLoading
      });
    }
  }, [handleSubmit, effectiveViewOnly, canSubmitChecklist, submitMutation.isLoading, onExposeSubmit, hasWelfareChecklistCreate, hasWelfareChecklistUpdate, hasWelfareChecklistAll]);

  if (checklistLoading || responsesLoading) {
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

  return (
    <>
      {/* Toast Notification for Success */}
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
      <Card>
      <Card.Header>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            File Submission Checklist: Welfare / Upliftment Cases
          </h3>
          {completionStatus.total > 0 && (
            <Chip variant={completionStatus.isComplete ? 'success' : 'warning'} size="sm">
              {completionStatus.completionPercentage}% Complete ({completionStatus.filled}/{completionStatus.total})
            </Chip>
          )}
        </div>
      </Card.Header>
      <Card.Content>
        <div className="space-y-6">
          {/* Instructions */}
          <Alert severity="info">
            <div className="text-sm">
              <p className="font-medium mb-1">Purpose of this checklist:</p>
              <p className="mb-1">This checklist is NOT to check if sections have been filled or not. All sections of the form must be filled.</p>
              <p>The purpose is to ensure details are correctly filled for realistic assessment. Mark YES if the section is filled correctly and relevant details are added. Mention in comments if addition/modification is required.</p>
            </div>
          </Alert>

          {/* Checklist Items by Category */}
          {grouped.map((category) => (
            <div key={category.id} className="border rounded-lg overflow-hidden">
              {/* Category Header */}
              <div className="bg-yellow-50 px-4 py-3 border-b">
                <h4 className="font-semibold text-gray-900">{category.category_name}</h4>
                {category.description && (
                  <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                )}
              </div>

              {/* Category Items */}
              <div className="bg-white">
                <table className="w-full table-fixed">
                  <thead className="bg-green-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b w-[10%]">Form Section</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b w-[35%]">Checklist Details</th>
                      <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 border-b w-[15%]">Properly filled: Y/N</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b w-[40%]">Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.items.map((item, index) => {
                      const itemResponse = responses[item.id] || { properly_filled: '', comments: '' };
                      const hasError = errors[item.id];

                      return (
                        <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 border-b w-[10%]">
                            {item.form_section}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 border-b w-[35%]">
                            <span className="flex items-start">
                              <span className="break-words whitespace-normal">{item.checklist_detail}</span>
                              {item.is_compulsory && (
                                <span className="text-red-600 font-bold ml-1 flex-shrink-0">*</span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center border-b w-[15%]">
                            {effectiveViewOnly ? (
                              <Chip variant={itemResponse.properly_filled === 'Y' ? 'success' : itemResponse.properly_filled === 'N' ? 'error' : 'secondary'} size="sm">
                                {itemResponse.properly_filled || '-'}
                              </Chip>
                            ) : (
                              <div className="flex justify-center space-x-4">
                                <label className="flex items-center space-x-1 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`response_${item.id}`}
                                    value="Y"
                                    checked={itemResponse.properly_filled === 'Y'}
                                    onChange={(e) => handleResponseChange(item.id, 'properly_filled', e.target.value)}
                                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                                  />
                                  <span className="text-sm text-gray-700">Y</span>
                                </label>
                                <label className="flex items-center space-x-1 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`response_${item.id}`}
                                    value="N"
                                    checked={itemResponse.properly_filled === 'N'}
                                    onChange={(e) => handleResponseChange(item.id, 'properly_filled', e.target.value)}
                                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                                  />
                                  <span className="text-sm text-gray-700">N</span>
                                </label>
                              </div>
                            )}
                            {hasError && (
                              <p className="text-xs text-red-600 mt-1">{hasError}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 border-b w-[40%]">
                            {effectiveViewOnly ? (
                              <p className="text-sm text-gray-700">{itemResponse.comments || '-'}</p>
                            ) : (
                              <>
                                <textarea
                                  value={itemResponse.comments}
                                  onChange={(e) => handleResponseChange(item.id, 'comments', e.target.value)}
                                  placeholder={itemResponse.properly_filled === 'Y' ? 'Comments are required when "Y" is selected' : 'Any addition, modification required in file?'}
                                  rows={4}
                                  className={`w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y ${
                                    itemResponse.properly_filled === 'Y' && (!itemResponse.comments || itemResponse.comments.trim() === '') 
                                      ? 'border-red-300 bg-red-50' 
                                      : 'border-gray-300'
                                  }`}
                                />
                                {itemResponse.properly_filled === 'Y' && (!itemResponse.comments || itemResponse.comments.trim() === '') && (
                                  <p className="text-xs text-red-600 mt-1">Comments are required when "Y" is selected</p>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Overall Remarks */}
          {grouped.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-yellow-50 px-4 py-3 border-b">
                <h4 className="font-semibold text-gray-900">Overall Remarks</h4>
              </div>
              <div className="bg-white p-4">
                {isViewOnly ? (
                  <p className="text-sm text-gray-700">{overallRemarks || 'No remarks'}</p>
                ) : (
                  <textarea
                    value={overallRemarks}
                    onChange={(e) => setOverallRemarks(e.target.value)}
                    placeholder="Enter overall remarks..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                )}
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <Alert severity="success" className="mb-4">
              {successMessage}
            </Alert>
          )}

          {/* Error Message */}
          {errors.submit && (
            <Alert severity="error">
              {errors.submit}
            </Alert>
          )}

          {/* Submit Button (only if user has permissions and not in view mode) - Exposed for modal usage */}
          {canSubmitChecklist && (
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                loading={submitMutation.isLoading}
                disabled={submitMutation.isLoading}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2"
              >
                {submitMutation.isLoading ? 'Submitting...' : 'Submit Checklist'}
              </Button>
            </div>
          )}

          {/* View Mode Indicator */}
          {effectiveViewOnly && (
            <Alert severity="info">
              {isCaseApproved 
                ? 'This case has been approved. The checklist is now read-only.'
                : 'You are viewing the checklist. Only welfare department can fill or modify it.'}
            </Alert>
          )}
        </div>
      </Card.Content>
    </Card>
    </>
  );
};

WelfareChecklistForm.displayName = 'WelfareChecklistForm';

export default WelfareChecklistForm;

