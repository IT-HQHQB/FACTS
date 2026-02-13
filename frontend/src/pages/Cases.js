import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { 
  Button, 
  Input, 
  Card, 
  Table, 
  Select, 
  Chip, 
  Modal, 
  Pagination,
  Alert,
  Switch,
  WorkflowProgress,
  SearchableSelect
} from '../components/ui';
import { useCounselingFormAccess, usePermission } from '../utils/permissionUtils';
import WelfareChecklistForm from '../components/WelfareChecklistForm';
import CoverLetterForm from '../components/CoverLetterForm';
import CaseSLAStatus from '../components/CaseSLAStatus';
import { generateCoverLetterPDF } from '../utils/generateCoverLetterPDF';

// Icon components
const AddIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

const ViewIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img" preserveAspectRatio="xMidYMid meet">
    <circle cx="32" cy="32" r="30" fill="#4fd1d9" />
    <g fill="#ffffff">
      <path d="M27 27.8h10v24H27z" />
      <circle cx="32" cy="17.2" r="5" />
    </g>
  </svg>
);

const EditIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const DeleteIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const Cases = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Use database-driven permission check
  const { hasAccess: hasCounselingFormAccess, loading: permissionLoading } = useCounselingFormAccess();
  
  // Check if user has permission to create cases
  const { hasPermission: canCreateCase, loading: createPermissionLoading } = usePermission('cases', 'create');
  // Check if user has permission to delete cases
  const { hasPermission: canDeleteCase } = usePermission('cases', 'delete');
  // Check if user has permission to assign cases
  const { hasPermission: canAssignCase } = usePermission('cases', 'assign_case');
  // Check if user has permission to assign counselors
  const { hasPermission: canAssignCounselor } = usePermission('cases', 'assign_counselor');
  // Check if user has permission to view welfare checklist (for approve button and checklist)
  const { hasPermission: hasWelfareChecklistView } = usePermission('welfare_checklist', 'view');
  const { hasPermission: hasWelfareChecklistCreate } = usePermission('welfare_checklist', 'create');
  const { hasPermission: hasWelfareChecklistUpdate } = usePermission('welfare_checklist', 'update');
  const { hasPermission: hasWelfareChecklistAll } = usePermission('welfare_checklist', 'all');
  // Cover letter form permissions
  const { hasPermission: hasCoverLetterFormsCreate } = usePermission('cover_letter_forms', 'create');
  const { hasPermission: hasCoverLetterFormsUpdate } = usePermission('cover_letter_forms', 'update');
  const { hasPermission: hasCoverLetterFormsRead } = usePermission('cover_letter_forms', 'read');
  // Payment management permissions
  const { hasPermission: hasPaymentManagementRead } = usePermission('payment_management', 'read');
  const { hasPermission: hasPaymentManagementUpdate } = usePermission('payment_management', 'update');
  // Case closure permission
  const { hasPermission: canCloseCase } = usePermission('cases', 'close_case');

  // Alternative approach: Check if user can access counseling forms by making an API call
  const checkCounselingFormAccess = async (caseId) => {
    try {
      // Try to access the counseling form endpoint
      await axios.get(`/api/counseling-forms/case/${caseId}`);
      return true;
    } catch (error) {
      // If we get a 403 (Forbidden), the user doesn't have access
      if (error.response?.status === 403) {
        return false;
      }
      // For other errors, assume they have access (let the backend handle it)
      return true;
    }
  };
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState({
    status: '',
    case_type: '',
    search: '',
    jamiat_id: '',
    jamaat_id: '',
    assigned_roles: '',
    assigned_counselor_id: '',
    current_workflow_stage_id: '',
  });
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterJamiatId, setFilterJamiatId] = useState('');
  const [filterJamaatId, setFilterJamaatId] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [selectedJamiatId, setSelectedJamiatId] = useState('');
  const [selectedJamaatId, setSelectedJamaatId] = useState('');
  const [applicantSearchTerm, setApplicantSearchTerm] = useState('');
  
  // Case Registration modal state (for applicant creation)
  const [createApiError, setCreateApiError] = useState('');
  const [isCreateFetchingFromApi, setIsCreateFetchingFromApi] = useState(false);
  const [pendingJamaatId, setPendingJamaatId] = useState(null);
  const [createApiJamiatId, setCreateApiJamiatId] = useState(null);
  const [createApiJamaatId, setCreateApiJamaatId] = useState(null);
  const [createPhotoPreview, setCreatePhotoPreview] = useState(null);
  const [previousCreateItsNumber, setPreviousCreateItsNumber] = useState('');
  
  // Welfare department modals
  const [welfareApprovalModalOpen, setWelfareApprovalModalOpen] = useState(false);
  const [welfareReworkModalOpen, setWelfareReworkModalOpen] = useState(false);
  const [resubmitModalOpen, setResubmitModalOpen] = useState(false);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [checklistError, setChecklistError] = useState('');
  const [checklistSubmitHandler, setChecklistSubmitHandler] = useState(null);
  // Cover letter modal state
  const [coverLetterModalOpen, setCoverLetterModalOpen] = useState(false);
  const [coverLetterCaseId, setCoverLetterCaseId] = useState(null);
  const [coverLetterSubmitHandler, setCoverLetterSubmitHandler] = useState(null);
  
  // Assign case modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningCaseId, setAssigningCaseId] = useState(null);
  const [assignSelectedRoleId, setAssignSelectedRoleId] = useState('');
  const [assignSelectedCounselorId, setAssignSelectedCounselorId] = useState('');
  // Counselor assignment modal state
  const [counselorAssignModalOpen, setCounselorAssignModalOpen] = useState(false);
  const [assigningCounselorCaseId, setAssigningCounselorCaseId] = useState(null);
  const [selectedCounselorId, setSelectedCounselorId] = useState('');
  const [counselorSearchTerm, setCounselorSearchTerm] = useState('');
  const [counselorAssignSuccess, setCounselorAssignSuccess] = useState('');
  const [welfareComments, setWelfareComments] = useState('');
  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Case closure modal state
  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const [closureTarget, setClosureTarget] = useState(null);
  const [closureReason, setClosureReason] = useState('');
  const [closureDocument, setClosureDocument] = useState(null);
  const [closureError, setClosureError] = useState('');

  // Executive department modals
  const [executiveApprovalModalOpen, setExecutiveApprovalModalOpen] = useState(false);
  const [executiveReworkModalOpen, setExecutiveReworkModalOpen] = useState(false);
  const [welfareForwardModalOpen, setWelfareForwardModalOpen] = useState(false);
  const [executiveComments, setExecutiveComments] = useState('');
  const [ziApprovalModalOpen, setZiApprovalModalOpen] = useState(false);
  const [ziRejectModalOpen, setZiRejectModalOpen] = useState(false);
  const [ziComments, setZiComments] = useState('');
  // Generic workflow action modal
  const [workflowActionModalOpen, setWorkflowActionModalOpen] = useState(false);
  const [workflowActionType, setWorkflowActionType] = useState(null); // 'approve' | 'reject'
  const [workflowComments, setWorkflowComments] = useState('');

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm();

  // Initialize search filter from URL query parameter (e.g., /cases?search=BS-0895)
  useEffect(() => {
    const searchFromUrl = searchParams.get('search') || '';
    if (searchFromUrl) {
      setFilters(prev => ({
        ...prev,
        search: searchFromUrl,
      }));
      setPage(1);
    }
  }, [searchParams]);
  
  // Watch for ITS number changes in create modal
  const watchedCreateItsNumber = watch('its_number');

  // Welfare approval mutation
  const welfareApprovalMutation = useMutation(
    ({ caseId, comments }) => axios.put(`/api/cases/${caseId}/welfare-approve`, { comments }),
    {
      onSuccess: () => {
        setWelfareApprovalModalOpen(false);
        setWelfareComments('');
        setSelectedCaseId(null);
        refetch();
      },
      onError: (error) => {
        console.error('Welfare approval error:', error);
        // Show error message from backend
        const errorMessage = error?.response?.data?.error || 'Failed to approve case';
        setChecklistError(errorMessage);
        setTimeout(() => setChecklistError(''), 5000); // Clear error after 5 seconds
      }
    }
  );

  // Welfare rework mutation
  const welfareReworkMutation = useMutation(
    ({ caseId, comments }) => axios.put(`/api/cases/${caseId}/welfare-reject`, { comments }),
    {
      onSuccess: () => {
        setWelfareReworkModalOpen(false);
        setWelfareComments('');
        setSelectedCaseId(null);
        refetch();
      },
      onError: (error) => {
        console.error('Welfare rework error:', error);
      }
    }
  );

  // Resubmit to welfare mutation
  const resubmitToWelfareMutation = useMutation(
    ({ caseId, comments }) => axios.put(`/api/cases/${caseId}/resubmit-welfare`, { comments }),
    {
      onSuccess: () => {
        setResubmitModalOpen(false);
        setWelfareComments('');
        setSelectedCaseId(null);
        refetch();
      },
      onError: (error) => {
        console.error('Resubmit to welfare error:', error);
      }
    }
  );

  // Executive approval mutation
  const executiveApprovalMutation = useMutation(
    ({ caseId, comments }) => axios.put(`/api/cases/${caseId}/executive-approve`, { comments }),
    {
      onSuccess: () => {
        setExecutiveApprovalModalOpen(false);
        setExecutiveComments('');
        setSelectedCaseId(null);
        refetch();
      },
      onError: (error) => {
        console.error('Executive approval error:', error);
      }
    }
  );

  // Handle PDF download for cover letter
  const handleDownloadCoverLetterPDF = async (caseId, caseNumber) => {
    try {
      // Fetch latest cover letter form data
      const formResponse = await axios.get(`/api/cover-letter-forms/case/${caseId}`);
      const formData = formResponse.data.form;

      if (!formData) {
        alert('Cover letter form not found');
        return;
      }

      // Get user info for PDF
      const user = JSON.parse(localStorage.getItem('user'));
      const userName = user?.full_name || user?.username || user?.name || 'System';

      // Generate PDF
      const pdfDoc = await generateCoverLetterPDF(formData, {
        caseNumber: caseNumber || formData.applicant_details?.case_id || `#${caseId}`,
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
      window.open(pdfUrl, '_blank');

      // Clean up blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
      }, 100);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(`Failed to generate PDF: ${error.message}`);
    }
  };

  // Handle Manzoori file click - opens Manzoori files in new tabs
  const handleManzooriClick = async (caseId) => {
    try {
      // 1) Fetch attachments for the case
      const response = await axios.get(`/api/attachments/case/${caseId}`);
      const manzooriFiles =
        response.data.attachments?.filter((file) => file.stage === 'manzoori') ||
        [];

      if (manzooriFiles.length === 0) {
        alert('No Manzoori files found for this case');
        return;
      }

      // 2) For each manzoori file, fetch the binary and open in a new tab
      for (const file of manzooriFiles) {
        try {
          const downloadResponse = await axios.get(
            `/api/attachments/download/${file.id}`,
            {
              responseType: 'blob',
            }
          );

          const contentType =
            downloadResponse.headers['content-type'] || 'application/pdf';
          const blob = new Blob([downloadResponse.data], { type: contentType });
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');

          // Clean up URL object after a short delay
          setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        } catch (err) {
          console.error('Error opening Manzoori file:', err);
          alert('Failed to open one of the Manzoori files.');
        }
      }
    } catch (error) {
      console.error('Error fetching Manzoori files:', error);
      alert('Failed to open Manzoori files');
    }
  };

  // Executive rework mutation
  const executiveReworkMutation = useMutation(
    ({ caseId, comments }) => axios.put(`/api/cases/${caseId}/executive-rework`, { comments }),
    {
      onSuccess: () => {
        setExecutiveReworkModalOpen(false);
        setExecutiveComments('');
        setSelectedCaseId(null);
        refetch();
      },
      onError: (error) => {
        console.error('Executive rework error:', error);
      }
    }
  );

  // Welfare forward rework mutation
  const welfareForwardMutation = useMutation(
    ({ caseId, comments }) => axios.put(`/api/cases/${caseId}/welfare-forward-rework`, { comments }),
    {
      onSuccess: () => {
        setWelfareForwardModalOpen(false);
        setWelfareComments('');
        setSelectedCaseId(null);
        refetch();
      },
      onError: (error) => {
        console.error('Welfare forward rework error:', error);
      }
    }
  );

  // ZI approval mutation
  const ziApprovalMutation = useMutation(
    ({ caseId, comments }) => axios.put(`/api/cases/${caseId}/zi-approve`, { comments }),
    {
      onSuccess: () => {
        setZiApprovalModalOpen(false);
        setZiComments('');
        setSelectedCaseId(null);
        refetch();
      },
      onError: (error) => {
        console.error('ZI approval error:', error);
      }
    }
  );

  // ZI reject mutation
  const ziRejectMutation = useMutation(
    ({ caseId, comments }) => axios.put(`/api/cases/${caseId}/zi-reject`, { comments }),
    {
      onSuccess: () => {
        setZiRejectModalOpen(false);
        setZiComments('');
        setSelectedCaseId(null);
        refetch();
      },
      onError: (error) => {
        console.error('ZI reject error:', error);
      }
    }
  );

  // Generic workflow action mutation (for permission-based buttons)
  const workflowActionMutation = useMutation(
    ({ caseId, action, comments }) => axios.put(`/api/cases/${caseId}/workflow-action`, { action, comments }),
    {
      onSuccess: () => {
        setWorkflowActionModalOpen(false);
        setWorkflowComments('');
        setSelectedCaseId(null);
        setWorkflowActionType(null);
        refetch();
        queryClient.invalidateQueries(['cases']);
      },
      onError: (error) => {
        console.error('Workflow action error:', error);
        alert(error?.response?.data?.error || 'Failed to perform action');
      }
    }
  );

  // Delete case mutation
  const deleteCaseMutation = useMutation(
    (caseId) => axios.delete(`/api/cases/${caseId}`),
    {
      onSuccess: () => {
        setDeleteModalOpen(false);
        setDeleteTarget(null);
        refetch();
      },
      onError: (error) => {
        console.error('Delete case error:', error);
        alert(error?.response?.data?.error || 'Failed to delete case');
      }
    }
  );

  const handleDeleteCase = (caseId, caseNumber) => {
    setDeleteTarget({ id: caseId, caseNumber });
    setDeleteModalOpen(true);
  };

  // Case closure mutation
  const closeCaseMutation = useMutation(
    ({ caseId, reason, document }) => {
      const formData = new FormData();
      formData.append('reason', reason);
      if (document) {
        formData.append('document', document);
      }
      return axios.post(`/api/cases/${caseId}/close`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    },
    {
      onSuccess: () => {
        setClosureModalOpen(false);
        setClosureTarget(null);
        setClosureReason('');
        setClosureDocument(null);
        setClosureError('');
        refetch();
        queryClient.invalidateQueries(['cases']);
      },
      onError: (error) => {
        console.error('Case closure error:', error);
        setClosureError(error?.response?.data?.error || 'Failed to close case');
      }
    }
  );

  const handleCloseCase = (caseId, caseNumber) => {
    setClosureTarget({ id: caseId, caseNumber });
    setClosureReason('');
    setClosureDocument(null);
    setClosureError('');
    setClosureModalOpen(true);
  };

  const handleCloseCaseSubmit = () => {
    if (!closureReason.trim()) {
      setClosureError('Please provide a reason for closure');
      return;
    }
    if (closureTarget) {
      closeCaseMutation.mutate({
        caseId: closureTarget.id,
        reason: closureReason,
        document: closureDocument
      });
    }
  };

  // Handler functions
  const handleWelfareApproval = async (caseId) => {
    try {
      // Check if checklist is submitted before allowing approval
      const statusResponse = await axios.get(`/api/welfare-checklist/status/${caseId}`);
      const statusData = statusResponse.data;
      
      // Check if checklist exists and has been submitted
      if (statusData.total > 0 && statusData.filled === 0) {
        // Checklist items exist but none are filled - not submitted
        setChecklistError('Submit the checklist and then approve the case.');
        setTimeout(() => setChecklistError(''), 5000); // Clear error after 5 seconds
        return;
      }
      
      // If checklist is partially filled but not complete
      if (statusData.total > 0 && statusData.filled > 0 && !statusData.isComplete) {
        setChecklistError(`Checklist incomplete. Please complete all checklist items before approving. (${statusData.filled}/${statusData.total} completed)`);
        setTimeout(() => setChecklistError(''), 5000); // Clear error after 5 seconds
        return;
      }
      
      // Checklist is submitted (or no checklist exists), proceed with approval
      setSelectedCaseId(caseId);
      setWelfareApprovalModalOpen(true);
      setChecklistError(''); // Clear any previous errors
    } catch (error) {
      // If there's an error checking status, we'll let the backend handle the validation
      // But check if it's a 404 (no checklist) or permission error
      if (error.response?.status === 404 || error.response?.status === 403) {
        // No checklist or no permission - allow approval (backend will handle validation)
        setSelectedCaseId(caseId);
        setWelfareApprovalModalOpen(true);
        setChecklistError('');
      } else {
        // Other errors - show message but allow user to proceed (backend will validate)
        console.error('Error checking checklist status:', error);
        setSelectedCaseId(caseId);
        setWelfareApprovalModalOpen(true);
        setChecklistError('');
      }
    }
  };

  const handleWelfareRework = (caseId) => {
    setSelectedCaseId(caseId);
    setWelfareReworkModalOpen(true);
  };

  const handleOpenChecklist = (caseId) => {
    setSelectedCaseId(caseId);
    setChecklistModalOpen(true);
  };

  const handleResubmitToWelfare = (caseId) => {
    setSelectedCaseId(caseId);
    setResubmitModalOpen(true);
  };

  const handleWelfareApprovalSubmit = () => {
    if (selectedCaseId) {
      welfareApprovalMutation.mutate({ caseId: selectedCaseId, comments: welfareComments });
    }
  };

  const handleWelfareReworkSubmit = () => {
    if (selectedCaseId && welfareComments.trim()) {
      welfareReworkMutation.mutate({ caseId: selectedCaseId, comments: welfareComments });
    }
  };

  const handleResubmitSubmit = () => {
    if (selectedCaseId) {
      resubmitToWelfareMutation.mutate({ caseId: selectedCaseId, comments: welfareComments });
    }
  };

  // Executive handler functions
  const handleExecutiveApproval = (caseId) => {
    setSelectedCaseId(caseId);
    setExecutiveApprovalModalOpen(true);
  };

  const handleExecutiveRework = (caseId) => {
    setSelectedCaseId(caseId);
    setExecutiveReworkModalOpen(true);
  };

  const handleWelfareForward = (caseId) => {
    setSelectedCaseId(caseId);
    setWelfareForwardModalOpen(true);
  };

  // ZI handler functions (keeping for backward compatibility)
  const handleZiApproval = (caseId) => {
    setSelectedCaseId(caseId);
    setZiApprovalModalOpen(true);
  };

  const handleZiReject = (caseId) => {
    setSelectedCaseId(caseId);
    setZiRejectModalOpen(true);
  };

  const handleZiApprovalSubmit = () => {
    if (selectedCaseId) {
      ziApprovalMutation.mutate({ caseId: selectedCaseId, comments: ziComments });
    }
  };

  const handleZiRejectSubmit = () => {
    if (selectedCaseId && ziComments.trim()) {
      ziRejectMutation.mutate({ caseId: selectedCaseId, comments: ziComments });
    }
  };

  // Generic workflow action handlers (for permission-based buttons)
  const handleWorkflowAction = (caseId, action) => {
    setSelectedCaseId(caseId);
    setWorkflowActionType(action);
    setWorkflowActionModalOpen(true);
  };

  const handleWorkflowActionSubmit = () => {
    if (selectedCaseId && workflowActionType) {
      if (workflowActionType === 'reject' && !workflowComments.trim()) {
        alert('Comments are required when rejecting a case');
        return;
      }
      workflowActionMutation.mutate({
        caseId: selectedCaseId,
        action: workflowActionType,
        comments: workflowComments
      });
    }
  };

  const handleExecutiveApprovalSubmit = () => {
    if (selectedCaseId) {
      executiveApprovalMutation.mutate({ caseId: selectedCaseId, comments: executiveComments });
    }
  };

  const handleExecutiveReworkSubmit = () => {
    if (selectedCaseId && executiveComments.trim()) {
      executiveReworkMutation.mutate({ caseId: selectedCaseId, comments: executiveComments });
    }
  };

  const handleWelfareForwardSubmit = () => {
    if (selectedCaseId && welfareComments.trim()) {
      welfareForwardMutation.mutate({ caseId: selectedCaseId, comments: welfareComments });
    }
  };

  const { data: casesData, isLoading, error, refetch } = useQuery(
    ['cases', page, filters, limit],
    () => axios.get('/api/cases', {
      params: {
        page,
        limit,
        ...filters,
      },
    }).then(res => {
      // Permissions are now included in the API response
      return {
        cases: res.data.cases || [],
        pagination: res.data.pagination || { total: 0, page: 1, limit: 20, pages: 0 }
      };
    }),
    {
      keepPreviousData: true,
    }
  );

  // Get counseling form stage permissions for current user (used for Manzoori visibility)
  // Permissions are role-based, so we can use any case ID; use first case in list if available
  const { data: stagePermissionsData } = useQuery(
    ['counseling-form-stage-permissions', casesData?.cases?.[0]?.id],
    async () => {
      // Permissions are role-based, so we can use any case ID; use first case in list
      const firstCaseId = casesData?.cases?.[0]?.id;
      if (!firstCaseId) return null;
      const res = await axios.get(`/api/counseling-forms/case/${firstCaseId}`);
      return res.data;
    },
    {
      enabled: !!casesData?.cases?.length,
      retry: false,
    }
  );

  const hasManzooriReadPermission =
    stagePermissionsData?.stage_permissions?.manzoori?.can_read === true;

  // Fetch applicants for the dropdown with filtering
  // Only use search term if it's not in the format "ITS - Name" (which means an applicant was selected)
  const isApplicantSelected = applicantSearchTerm?.includes(' - ');
  const searchTermForApi = isApplicantSelected ? '' : applicantSearchTerm;
  
  const { data: applicantsData } = useQuery(
    ['applicants', selectedJamiatId, selectedJamaatId, searchTermForApi],
    () => {
      const params = {};
      if (selectedJamiatId) params.jamiat_id = selectedJamiatId;
      if (selectedJamaatId) params.jamaat_id = selectedJamaatId;
      if (searchTermForApi) params.search = searchTermForApi;
      // Always fetch all applicants when filters are applied, without pagination limit for dropdown
      params.limit = 1000; // Large limit to get all filtered applicants
      return axios.get('/api/applicants', { params }).then(res => res.data);
    },
    {
      select: (data) => data.applicants || [],
    }
  );

  // Fetch case types
  const { data: caseTypesData } = useQuery(
    'caseTypes',
    () => axios.get('/api/case-types').then(res => res.data),
    {
      select: (data) => data.caseTypes || [],
    }
  );


  // Fetch users for assign case modal - using role name (not ID) like case creation
  const { data: assignUsersData } = useQuery(
    ['users', assignSelectedRoleId],
    () => {
      const params = {};
      if (assignSelectedRoleId) params.role = assignSelectedRoleId; // This is now role name, not ID
      params.is_active = 'true'; // Only fetch active users for assignment
      return axios.get('/api/users', { params }).then(res => res.data);
    },
    {
      select: (data) => data.users || [],
      enabled: !!assignSelectedRoleId,
    }
  );

  // Fetch roles for assign case modal - same as case creation
  const { data: assignRolesData } = useQuery(
    'roles',
    () => axios.get('/api/users/roles').then(res => res.data),
    {
      select: (data) => data.roles || [],
    }
  );

  // Fetch available counselors for assignment (filtered by case location)
  const { data: availableCounselorsData } = useQuery(
    ['available-counselors', assigningCounselorCaseId],
    () => {
      const params = {};
      if (assigningCounselorCaseId) params.caseId = assigningCounselorCaseId;
      return axios.get('/api/cases/available-counselors', { params }).then(res => res.data);
    },
    {
      select: (data) => data.counselors || [],
      enabled: !!assigningCounselorCaseId && counselorAssignModalOpen,
    }
  );

  // Fetch all counselors for filter (not filtered by case)
  const { data: allCounselorsData } = useQuery(
    'all-counselors',
    () => {
      return axios.get('/api/users', { params: { role: 'counselor', is_active: 'true' } }).then(res => res.data);
    },
    {
      select: (data) => data.users || [],
    }
  );

  // Fetch all users for "Assign to" filter
  const { data: filterUsersData } = useQuery(
    'filter-users',
    () => {
      return axios.get('/api/users', { params: { is_active: 'true' } }).then(res => res.data);
    },
    {
      select: (data) => data.users || [],
    }
  );

  // Fetch workflow stages for filter
  const { data: workflowStagesData } = useQuery(
    'workflow-stages',
    () => {
      return axios.get('/api/workflow-stages').then(res => res.data);
    },
    {
      select: (data) => data.stages || [],
      onError: (error) => {
        // Silently handle permission errors - workflow stages might require admin access
        console.warn('Could not fetch workflow stages for filter:', error);
      },
    }
  );

  // Assign case mutation - same as case creation: assign_roles is user ID, assigned_counselor_id is null
  const assignCaseMutation = useMutation(
    ({ caseId, assigned_roles }) =>
      axios.put(`/api/cases/${caseId}`, { assigned_roles, assigned_counselor_id: null }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['cases', page, filters]);
        setAssignModalOpen(false);
        setAssigningCaseId(null);
        setAssignSelectedRoleId('');
        setAssignSelectedCounselorId('');
      },
    }
  );

  // Assign counselor mutation
  const assignCounselorMutation = useMutation(
    ({ caseId, assigned_counselor_id }) =>
      axios.put(`/api/cases/${caseId}`, { assigned_counselor_id }),
    {
      onSuccess: (response, variables) => {
        const isUnassign = variables.assigned_counselor_id === null;
        queryClient.invalidateQueries(['cases', page, filters]);
        queryClient.invalidateQueries(['available-counselors', assigningCounselorCaseId]);
        setCounselorAssignModalOpen(false);
        setAssigningCounselorCaseId(null);
        setSelectedCounselorId('');
        setCounselorSearchTerm('');
        setCounselorAssignSuccess(isUnassign ? 'Counselor unassigned successfully!' : 'Counselor assigned successfully!');
        // Clear success message after 3 seconds
        setTimeout(() => {
          setCounselorAssignSuccess('');
        }, 3000);
      },
      onError: (error) => {
        console.error('Assign counselor error:', error);
        setCounselorAssignSuccess('');
      },
    }
  );

  const handleAssignCaseClick = (caseId) => {
    setAssigningCaseId(caseId);
    setAssignModalOpen(true);
  };

  const handleAssignCase = () => {
    // assignSelectedCounselorId is now the DCM user ID (from "Assign To" dropdown)
    if (assignSelectedCounselorId && assigningCaseId) {
      assignCaseMutation.mutate({
        caseId: assigningCaseId,
        assigned_roles: assignSelectedCounselorId, // This is the user ID of the DCM
      });
    }
  };

  // Handler for opening counselor assignment modal
  const handleAssignCounselorClick = (caseId) => {
    setAssigningCounselorCaseId(caseId);
    setCounselorAssignModalOpen(true);
    setSelectedCounselorId('');
    setCounselorSearchTerm('');
  };

  // Handler for assigning counselor to case
  const handleAssignCounselor = () => {
    if (selectedCounselorId && assigningCounselorCaseId) {
      assignCounselorMutation.mutate({
        caseId: assigningCounselorCaseId,
        assigned_counselor_id: selectedCounselorId === 'unassign' ? null : selectedCounselorId,
      });
    }
  };

  // Fetch jamiat data with error handling and filtering
  const { data: jamiatData, isLoading: jamiatLoading, error: jamiatError } = useQuery(
    'jamiat',
    () => axios.get('/api/jamiat').then(res => res.data),
    {
      select: (data) => {
        const jamiatList = data.jamiat || [];
        // Filter to show only active jamiat
        const activeJamiat = jamiatList.filter(jamiat => jamiat.is_active === true || jamiat.is_active === 1);
        console.log('Jamiat data received:', { total: jamiatList.length, active: activeJamiat.length, data: activeJamiat });
        return activeJamiat;
      },
      onError: (error) => {
        console.error('Error fetching jamiat:', error);
      },
    }
  );

  // Reset jamaat_id when jamiat_id changes
  useEffect(() => {
    if (selectedJamiatId) {
      setValue('jamaat_id', '');
      setSelectedJamaatId('');
    }
  }, [selectedJamiatId, setValue]);

  // Reset filter jamaat when filter jamiat changes or is cleared
  useEffect(() => {
    if (!filterJamiatId) {
      setFilterJamaatId('');
      handleFilterChange('jamaat_id', '');
    }
  }, [filterJamiatId]);

  // Sync filter state when modal opens
  useEffect(() => {
    if (filterModalOpen) {
      setFilterJamiatId(filters.jamiat_id || '');
      setFilterJamaatId(filters.jamaat_id || '');
    }
  }, [filterModalOpen]);

  // Effect to handle ITS number changes in create modal
  useEffect(() => {
    if (watchedCreateItsNumber && watchedCreateItsNumber !== previousCreateItsNumber && watchedCreateItsNumber.length >= 3) {
      // Add a small delay to avoid too frequent API calls
      const timer = setTimeout(() => {
        fetchFromApiForCreate(watchedCreateItsNumber);
      }, 500);
      
      setPreviousCreateItsNumber(watchedCreateItsNumber);
      
      return () => clearTimeout(timer);
    }
  }, [watchedCreateItsNumber, previousCreateItsNumber]);

  // Fetch jamaat data based on selected jamiat (for create modal)
  const { data: jamaatData, isLoading: jamaatLoading } = useQuery(
    ['jamaat', selectedJamiatId],
    () => {
      const params = {};
      if (selectedJamiatId) {
        params.jamiat_id = selectedJamiatId;
      }
      return axios.get('/api/jamaat', { params }).then(res => res.data);
    },
    {
      select: (data) => {
        const jamaatList = data.jamaat || [];
        // Filter by jamiat_id on frontend as well to ensure correct filtering
        if (selectedJamiatId) {
          return jamaatList.filter(jamaat => jamaat.jamiat_id == selectedJamiatId);
        }
        return jamaatList;
      },
      enabled: true, // Always enabled, but filtered by jamiat_id
    }
  );

  // Fetch jamaat data for filter modal based on filterJamiatId
  const { data: filterJamaatData } = useQuery(
    ['jamaat', filterJamiatId],
    () => {
      const params = {};
      if (filterJamiatId) {
        params.jamiat_id = filterJamiatId;
      }
      return axios.get('/api/jamaat', { params }).then(res => res.data);
    },
    {
      select: (data) => {
        const jamaatList = data.jamaat || [];
        // Filter by jamiat_id on frontend as well to ensure correct filtering
        if (filterJamiatId) {
          return jamaatList.filter(jamaat => jamaat.jamiat_id == filterJamiatId);
        }
        return jamaatList;
      },
      enabled: true,
    }
  );

  // Set jamaat_id when jamaatData is loaded and we have a pending jamaat_id from API
  useEffect(() => {
    if (jamaatData && pendingJamaatId) {
      setValue('jamaat_id', pendingJamaatId);
      setPendingJamaatId(null);
    }
  }, [jamaatData, pendingJamaatId, setValue]);

  const createApplicantMutation = useMutation(
    (applicantData) => axios.post('/api/applicants', applicantData),
    {
      onError: (error) => {
        setCreateError(error.response?.data?.message || 'Failed to create applicant');
        setCreateSuccess('');
      },
    }
  );

  const createCaseMutation = useMutation(
    (caseData) => axios.post('/api/cases', caseData),
    {
      onSuccess: (response) => {
        setCreateSuccess('Applicant and case created successfully!');
        setCreateError('');
        reset();
        setCreatePhotoPreview(null);
        setCreateModalOpen(false);
        refetch(); // Refresh the cases list
        // Navigate to the case detail page
        const caseId = response.data.caseId;
        if (caseId) {
          setTimeout(() => {
            navigate(`/cases/${caseId}`);
          }, 1500);
        }
      },
      onError: (error) => {
        setCreateError(error.response?.data?.error || error.response?.data?.message || 'Failed to create case');
        setCreateSuccess('');
      },
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
    setPage(1); // Reset to first page when filters change
  };

  // Reset page to 1 when limit changes
  useEffect(() => {
    setPage(1);
  }, [limit]);

  const handleSearch = (e) => {
    e.preventDefault();
    refetch();
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      case_type: '',
      search: '',
      jamiat_id: '',
      jamaat_id: '',
      assigned_roles: '',
      assigned_counselor_id: '',
      current_workflow_stage_id: '',
    });
    setFilterJamiatId('');
    setFilterJamaatId('');
    setPage(1);
  };

  const onSubmit = async (data) => {
    // Prevent double submission
    if (createApplicantMutation.isLoading || createCaseMutation.isLoading) {
      return;
    }

    setCreateError('');
    setCreateSuccess('');
    
    try {
      // Split full name into first and last name
      const nameParts = data.full_name?.trim().split(' ') || [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Prepare applicant data for auto-creation
      const applicantData = {
        its_number: data.its_number,
        first_name: firstName,
        last_name: lastName,
        age: data.age,
        gender: data.gender,
        phone: data.phone,
        email: data.email,
        photo: data.photo || null,
        address: data.address,
        jamiat_name: data.jamiat_name,
        jamaat_name: data.jamaat_name,
        jamiat_id: createApiJamiatId,
        jamaat_id: createApiJamaatId
      };
      
      // Create case with applicant_data - backend will auto-create applicant
      const caseData = {
        applicant_data: applicantData, // Send applicant data for auto-creation
        case_type_id: data.case_type_id,
        roles: null,
        assigned_counselor_id: null,
        jamiat_id: createApiJamiatId || null,
        jamaat_id: createApiJamaatId || null,
        assigned_role: null,
        description: data.description,
        notes: data.notes || null
      };
      
      console.log('💾 Creating case with applicant data (bidirectional creation):', {
        ...caseData,
        applicant_data: {
          ...applicantData,
          photo: applicantData.photo ? `Photo included (${(applicantData.photo.length / 1024).toFixed(2)} KB)` : 'NO PHOTO'
        }
      });
      
      // Create case - backend will auto-create applicant if needed
      await createCaseMutation.mutateAsync(caseData);
      
      console.log('✅ Case and applicant created successfully');
    } catch (error) {
      console.error('❌ Failed to create applicant or case:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error details:', error.response?.data?.details || error.response?.data?.error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to create applicant or case';
      setCreateError(errorMessage);
      setCreateSuccess('');
    }
  };

  // Handle Enter key press on ITS number field for create modal
  const handleCreateItsNumberKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const itsNumber = e.target.value.trim();
      if (itsNumber && itsNumber.length >= 3) {
        fetchFromApiForCreate(itsNumber);
      } else {
        setCreateApiError('Please enter a valid ITS number (minimum 3 characters)');
      }
    }
  };

  // Function to fetch data from external API for create modal
  const fetchFromApiForCreate = async (itsNumber) => {
    if (!itsNumber || itsNumber.trim() === '') {
      return; // Don't fetch if ITS number is empty
    }

    setIsCreateFetchingFromApi(true);
    setCreateApiError('');

    try {
      const response = await axios.get(`/api/applicants/fetch-from-api/${itsNumber}`);
      const apiData = response.data.data;
      
      console.log('🔍 API Response for ITS', itsNumber, ':', apiData);
      console.log('📸 Photo data received:', apiData.photo ? `YES (${(apiData.photo.length / 1024).toFixed(2)} KB)` : 'NO');

      // Auto-fill form fields with API data
      if (apiData.full_name) {
        setValue('full_name', apiData.full_name);
      }
      
      if (apiData.age) {
        setValue('age', apiData.age);
      }
      if (apiData.gender) {
        setValue('gender', apiData.gender);
      }
      if (apiData.phone) {
        setValue('phone', apiData.phone);
      }
      if (apiData.email) {
        setValue('email', apiData.email);
      }
      if (apiData.photo) {
        console.log('✅ Setting photo in form and preview');
        setValue('photo', apiData.photo);
        setCreatePhotoPreview(apiData.photo);
      } else {
        console.log('⚠️ No photo data available from API');
        setValue('photo', null);
        setCreatePhotoPreview(null);
      }
      if (apiData.address) {
        setValue('address', apiData.address);
      }
      
      // Set jamiat and jamaat names and IDs from API data
      if (apiData.jamiat_name) {
        setValue('jamiat_name', apiData.jamiat_name);
      }
      if (apiData.jamaat_name) {
        setValue('jamaat_name', apiData.jamaat_name);
      }
      
      // Store the IDs for submission
      if (apiData.jamiat_id) {
        setCreateApiJamiatId(apiData.jamiat_id);
      }
      if (apiData.jamaat_id) {
        setCreateApiJamaatId(apiData.jamaat_id);
      }

      setCreateSuccess('Data fetched successfully from external API!');
      setCreateError('');
      
    } catch (error) {
      console.error('❌ Create API fetch error:', error);
      setCreateApiError(error.response?.data?.error || 'Failed to fetch data from external API');
    } finally {
      setIsCreateFetchingFromApi(false);
    }
  };

  const handleCreateModalClose = () => {
    setCreateModalOpen(false);
    setCreateError('');
    setCreateSuccess('');
    setCreateApiError('');
    setSelectedJamiatId('');
    setSelectedJamaatId('');
    setApplicantSearchTerm('');
    setCreatePhotoPreview(null);
    setCreateApiJamiatId(null);
    setCreateApiJamaatId(null);
    setPendingJamaatId(null);
    reset();
  };

  const getStatusColor = (status) => {
    const statusColors = {
      draft: 'default',
      assigned: 'info',
      in_counseling: 'warning',
      cover_letter_generated: 'primary',
      submitted_to_welfare: 'secondary',
      welfare_approved: 'success',
      welfare_rejected: 'error',
      welfare_processing_rework: 'warning',
      submitted_to_zi: 'success',
      submitted_to_zi_review: 'success',
      zi_approved: 'success',
      zi_rejected: 'error',
      submitted_to_kg_review: 'primary',
      submitted_to_operations_lead: 'warning',
      submitted_to_executive_1: 'info',
      executive_1_approved: 'success',
      submitted_to_executive_2: 'info',
      executive_2_approved: 'success',
      submitted_to_executive_3: 'info',
      executive_3_approved: 'success',
      submitted_to_executive_4: 'info',
      executive_4_approved: 'success',
      executive_approved: 'success',
      executive_rejected: 'error',
      finance_disbursement: 'success',
      completed: 'success',
      closed: 'default',
    };
    return statusColors[status] || 'default';
  };


  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatStatus = (status) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Workflow steps for progress bar
  const workflowSteps = [
    { id: 'personal', label: 'Personal Details' },
    { id: 'family', label: 'Family Details' },
    { id: 'assessment', label: 'Assessment' },
    { id: 'financial', label: 'Financial Assistance' },
    { id: 'growth', label: 'Economic Growth' },
    { id: 'declaration', label: 'Declaration' },
    { id: 'attachments', label: 'Attachments' }
  ];

  // Function to get workflow progress based on actual section completion data
  const getCaseWorkflowProgress = (statusName, sectionCompletion = {}) => {
    let currentStep = 0;
    let completedSteps = [];

    // Extract section completion flags (default to false if not provided)
    const {
      personal_details_completed = false,
      family_details_completed = false,
      assessment_completed = false,
      financial_assistance_completed = false,
      economic_growth_completed = false,
      declaration_completed = false,
      attachments_completed = false,
      all_sections_completed = false
    } = sectionCompletion;

    // If all sections are completed, show all 7 stages as complete
    if (all_sections_completed || (
      personal_details_completed &&
      family_details_completed &&
      assessment_completed &&
      financial_assistance_completed &&
      economic_growth_completed &&
      declaration_completed &&
      attachments_completed
    )) {
      currentStep = 6; // Last step index (attachments)
      completedSteps = ['personal', 'family', 'assessment', 'financial', 'growth', 'declaration', 'attachments'];
      return { currentStep, completedSteps };
    }

    // Determine completed steps based on actual section completion
    if (personal_details_completed) completedSteps.push('personal');
    if (family_details_completed) completedSteps.push('family');
    if (assessment_completed) completedSteps.push('assessment');
    if (financial_assistance_completed) completedSteps.push('financial');
    if (economic_growth_completed) completedSteps.push('growth');
    if (declaration_completed) completedSteps.push('declaration');
    if (attachments_completed) completedSteps.push('attachments');

    // Determine current step based on completed sections
    // Current step is the index (0-based) of the next incomplete step after the last completed one
    if (attachments_completed) {
      currentStep = 6; // All done, show attachments as last step
    } else if (declaration_completed) {
      currentStep = 6; // Working on attachments
    } else if (economic_growth_completed) {
      currentStep = 5; // Working on declaration
    } else if (financial_assistance_completed) {
      currentStep = 4; // Working on economic growth
    } else if (assessment_completed) {
      currentStep = 3; // Working on financial assistance
    } else if (family_details_completed) {
      currentStep = 2; // Working on assessment
    } else if (personal_details_completed) {
      currentStep = 1; // Working on family details
    } else {
      // No sections completed yet
      // Use status to determine if we're in draft/assigned state
      if (statusName === 'draft' || statusName === 'assigned') {
        currentStep = 0; // Before starting
      } else {
        currentStep = 0; // Starting personal details
      }
    }

    // For post-counseling statuses, ensure all stages are shown as completed
    const postCounselingStatuses = [
      'cover_letter_generated',
      'submitted_to_welfare',
      'welfare_approved',
      'welfare_rejected',
      'welfare_processing_rework',
      'submitted_to_executive',
      'submitted_to_executive_1',
      'submitted_to_executive_2',
      'submitted_to_executive_3',
      'submitted_to_executive_4',
      'executive_1_approved',
      'executive_2_approved',
      'executive_3_approved',
      'executive_4_approved',
      'executive_approved',
      'executive_rejected',
      'finance_disbursement',
      'completed',
      'closed'
    ];

    if (postCounselingStatuses.includes(statusName)) {
      currentStep = 6; // Last step index (attachments)
      completedSteps = ['personal', 'family', 'assessment', 'financial', 'growth', 'declaration', 'attachments'];
    }

    return { currentStep, completedSteps };
  };

  // Function to get the current workflow step name based on case status and section completion
  const getCurrentWorkflowStepName = (statusName, sectionCompletion = {}) => {
    const { currentStep } = getCaseWorkflowProgress(statusName, sectionCompletion);
    
    if (currentStep >= workflowSteps.length) {
      return 'Completed';
    }
    
    return workflowSteps[currentStep]?.label || 'Pending';
  };

  if (error) {
    return (
      <div className="p-6">
        <Alert severity="error">
          Error loading cases: {error.message}
        </Alert>
      </div>
    );
  }

  return (
    <div className="px-2 py-4 bg-gray-50 min-h-screen relative z-0">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Cases</h1>
            <p className="text-gray-600 text-lg">Manage and track case information</p>
          </div>
          {canCreateCase && (
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <AddIcon />
              <span>Case Registration</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6 relative z-10">
        <div className="p-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
            <form onSubmit={handleSearch} className="flex-1 flex space-x-3">
              <div className="flex-1">
                <Input
                  placeholder="Search cases, applicants, or case numbers..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="border-2 border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                />
              </div>
              <Button type="submit" variant="primary" className="px-6">
                Search
              </Button>
            </form>
            
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-700 whitespace-nowrap">Rows per page:</label>
                <Select
                  value={limit.toString()}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-32"
                >
                  <Select.Option value="20">20</Select.Option>
                  <Select.Option value="50">50</Select.Option>
                  <Select.Option value="100">100</Select.Option>
                  <Select.Option value="500">500</Select.Option>
                  <Select.Option value="1500">1500</Select.Option>
                  <Select.Option value="2000">2000</Select.Option>
                  <Select.Option value="2500">2500</Select.Option>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => setFilterModalOpen(true)}
                className="flex items-center space-x-2 border-2 border-gray-300 hover:border-primary-500"
              >
                <FilterIcon />
                <span>Filters</span>
              </Button>
              <Button
                variant="secondary"
                onClick={clearFilters}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Success Message for Counselor Assignment */}
      {counselorAssignSuccess && (
        <div className="mb-4">
          <Alert 
            severity="success" 
            onClose={() => setCounselorAssignSuccess('')}
          >
            {counselorAssignSuccess}
          </Alert>
        </div>
      )}

      {/* Checklist Error Alert */}
      {checklistError && (
        <div className="mb-4">
          <Alert 
            severity="error" 
            onClose={() => setChecklistError('')}
          >
            {checklistError}
          </Alert>
        </div>
      )}

      {/* Cases Table */}
      <Card>
        <div className="p-3">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Cases ({casesData?.pagination?.total || 0})
                </h3>
                <p className="text-sm text-gray-600 mt-1">View and manage all case records</p>
              </div>
              
              <div className="overflow-x-hidden">
                <div className="overflow-x-hidden">
                  <table className="w-full table-fixed divide-y divide-gray-200">
                  <Table.Head>
                    <Table.Row className="bg-gray-50">
                      <Table.Header className="font-semibold text-gray-900 w-24 !px-2">Case Number</Table.Header>
                      <Table.Header className="font-semibold text-gray-900 w-44 !px-2">Applicant</Table.Header>
                      <Table.Header className="font-semibold text-gray-900 w-36 !px-2">Jamaat</Table.Header>
                      <Table.Header className="font-semibold text-gray-900 w-28 !px-2">Case Type</Table.Header>
                      <Table.Header className="font-semibold text-gray-900 w-28 !px-2">Status</Table.Header>
                      <Table.Header className="font-semibold text-gray-900 w-32 !px-2">Assign to</Table.Header>
                      <Table.Header className="font-semibold text-gray-900 w-36 !px-2">Counselor</Table.Header>
                      <Table.Header align="center" className="font-semibold text-gray-900 w-28 !px-2 !text-center [&>div]:!justify-center">Workflow</Table.Header>
                      <Table.Header className="font-semibold text-gray-900 w-48 !px-1">Case Stage</Table.Header>
                      <Table.Header className="font-semibold text-gray-900 w-32 !px-1">SLA Status</Table.Header>
                      <Table.Header align="center" className="font-semibold text-gray-900 w-24 !px-1 !text-center [&>div]:!justify-center">Created Date</Table.Header>
                      <Table.Header align="center" className="font-semibold text-gray-900 w-28 !px-2 !text-center [&>div]:!justify-center">Actions</Table.Header>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {casesData?.cases?.filter(caseItem => caseItem).map((caseItem) => (
                      <Table.Row key={caseItem.id} hover className="hover:bg-gray-50 transition-colors duration-150">
                      <Table.Cell className="overflow-hidden !px-2">
                        <div className="font-medium text-gray-900 break-words whitespace-normal">
                          {caseItem.case_number}
                        </div>
                      </Table.Cell>
                      <Table.Cell className="overflow-hidden !px-2">
                        <div>
                          <div className="font-medium text-gray-900 break-words whitespace-normal">
                            {caseItem.applicant_full_name}
                          </div>
                          <div className="text-sm text-gray-500 break-words whitespace-normal">
                            ITS: {caseItem.its_number}
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="overflow-hidden !px-2">
                        <div className="text-sm text-gray-900 break-words whitespace-normal">
                          {caseItem.jamaat_name || 'N/A'}
                        </div>
                      </Table.Cell>
                      <Table.Cell className="overflow-hidden !px-2">
                        <div className="text-sm text-gray-900 break-words whitespace-normal">
                          {caseItem.case_type_name || 'N/A'}
                        </div>
                      </Table.Cell>
                      <Table.Cell className="overflow-hidden !px-2">
                        {caseItem.status_name && caseItem.status_name.trim() ? (
                          <Chip variant={getStatusColor(caseItem.status_name)}>
                            <span className="break-words whitespace-normal">{formatStatus(caseItem.status_name)}</span>
                          </Chip>
                        ) : (
                          <span className="text-gray-400 text-sm">Not set</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="overflow-hidden !px-2">
                        <div className="text-sm text-gray-900 break-words whitespace-normal">
                          {caseItem.roles_full_name ? (
                            <span className="font-medium">{caseItem.roles_full_name}</span>
                          ) : (
                            <span className="text-gray-400">Unassigned</span>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell className="overflow-hidden !px-2">
                        <div className="text-sm text-gray-900 break-words whitespace-normal">
                          {caseItem.counselor_full_name ? (
                            <span className="font-medium text-blue-600">{caseItem.counselor_full_name}</span>
                          ) : (
                            <span className="text-gray-400">Unassigned</span>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell align="center" className="overflow-hidden !px-2 !text-center">
                        <div className="flex items-center justify-center w-full">
                          {/* Check if user has counseling form access based on database permissions */}
                          {hasCounselingFormAccess ? (
                            <>
                              {caseItem.all_sections_completed ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => navigate(`/counseling-form/${caseItem.id}`)}
                                  className="flex items-center space-x-1 text-xs"
                                >
                                  <span>►</span>
                                  <span className="break-words whitespace-normal">View Form</span>
                                </Button>
                              ) : caseItem.status_name === 'in_counseling' || 
                               caseItem.counseling_form_completed ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => navigate(`/counseling-form/${caseItem.id}`)}
                                  className="flex items-center space-x-1 text-xs"
                                >
                                  <span>►</span>
                                  <span className="break-words whitespace-normal">Continue</span>
                                </Button>
                              ) : caseItem.status_name === 'assigned' && caseItem.roles_full_name && !caseItem.counseling_form_completed ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => navigate(`/counseling-form/${caseItem.id}`)}
                                  className="flex items-center space-x-1 text-xs"
                                >
                                  <span>►</span>
                                  <span className="break-words whitespace-normal">Start</span>
                                </Button>
                              ) : canAssignCase && (caseItem.status_name === 'draft' || !caseItem.roles_full_name || !caseItem.roles || caseItem.roles === null || caseItem.roles === '' || (Array.isArray(caseItem.roles) && caseItem.roles.length === 0)) ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleAssignCaseClick(caseItem.id)}
                                  className="flex items-center space-x-1 text-xs"
                                >
                                  <span>►</span>
                                  <span className="break-words whitespace-normal">Assign Case</span>
                                </Button>
                              ) : caseItem.status_name === 'draft' ? (
                                <span className="text-xs text-gray-500 break-words whitespace-normal">Not applicable</span>
                              ) : caseItem.status_name === 'completed' || caseItem.status_name === 'closed' ? (
                                <span className="text-xs text-gray-500 break-words whitespace-normal">Completed</span>
                              ) : (
                                <span className="text-xs text-gray-500 break-words whitespace-normal">Completed</span>
                              )}
                            </>
                          ) : (
                            /* For users without counseling form access, show View button */
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/cases/${caseItem.id}`)}
                              className="flex items-center justify-center w-10 h-10 border-0 hover:bg-primary-50 text-gray-600 hover:text-primary-600"
                              title="View Case"
                            >
                              <ViewIcon />
                            </Button>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell className="overflow-hidden !px-1">
                        <div className="flex flex-col items-start space-y-2 break-words whitespace-normal">
                          {caseItem.current_workflow_stage_name ? (
                            <div className="text-sm text-gray-900 font-medium">
                              {caseItem.current_workflow_stage_name}
                            </div>
                          ) : caseItem.status_name ? (
                            (() => {
                              const sectionCompletion = {
                                personal_details_completed: caseItem.personal_details_completed,
                                family_details_completed: caseItem.family_details_completed,
                                assessment_completed: caseItem.assessment_completed,
                                financial_assistance_completed: caseItem.financial_assistance_completed,
                                economic_growth_completed: caseItem.economic_growth_completed,
                                declaration_completed: caseItem.declaration_completed,
                                attachments_completed: caseItem.attachments_completed,
                                all_sections_completed: caseItem.all_sections_completed
                              };
                              const progress = getCaseWorkflowProgress(caseItem.status_name, sectionCompletion);
                              return (
                                <>
                                  <WorkflowProgress
                                    steps={workflowSteps}
                                    currentStep={progress.currentStep}
                                    completedSteps={progress.completedSteps}
                                    className="!p-0 !border-none !bg-transparent"
                                    compact={true}
                                  />
                                  <span className="text-xs text-gray-600 font-medium break-words whitespace-normal w-full">
                                    {getCurrentWorkflowStepName(caseItem.status_name, sectionCompletion)}
                                  </span>
                                </>
                              );
                            })()
                          ) : (
                            <span className="text-xs text-gray-400">Not set</span>
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell className="overflow-hidden !px-1">
                        <CaseSLAStatus 
                          slaInfo={caseItem.slaInfo}
                          slaValue={caseItem.sla_value}
                          slaUnit={caseItem.sla_unit}
                        />
                      </Table.Cell>
                      <Table.Cell align="center" className="overflow-hidden !px-1 !text-center">
                        <div className="text-sm text-gray-900 break-words whitespace-normal text-center w-full">
                          {formatDate(caseItem.created_at)}
                        </div>
                      </Table.Cell>
                      <Table.Cell align="center" className="overflow-hidden !px-2 !text-center">
                        <div className="flex items-center justify-center space-x-1 flex-wrap gap-1 w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/cases/${caseItem.id}`)}
                            className="flex items-center justify-center w-10 h-10 border-0 hover:bg-primary-50 text-gray-600 hover:text-primary-600"
                            title="View Case"
                          >
                            <ViewIcon />
                          </Button>
                          
                          {/* Payment Schedule Button - Show only at finance disbursement stage when user has payment management permission */}
                          {(caseItem.status_name === 'finance_disbursement' ||
                            caseItem.current_workflow_stage_name === 'Finance Disbursement') &&
                            hasPaymentManagementRead && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => navigate(`/cases/${caseItem.id}/payment-schedule`)}
                              className="flex items-center space-x-1 bg-primary-600 hover:bg-primary-700 text-white"
                              title="Manage Payment Schedule"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="hidden sm:inline">Payment</span>
                            </Button>
                          )}

                          {/* Cover Letter Button - Show when in Cover Letter stage OR cover letter form exists (until finance_disbursement) */}
                          {(() => {
                            const isCoverLetterStage = caseItem.current_workflow_stage_name === 'Cover Letter' || caseItem.status_name === 'submitted_to_cover_letter';
                            const showCoverLetterBlock = caseItem.status_name !== 'finance_disbursement' && (caseItem.cover_letter_form_exists || isCoverLetterStage);
                            return showCoverLetterBlock && (hasCoverLetterFormsCreate || hasCoverLetterFormsUpdate || hasCoverLetterFormsRead ||
                             user?.role === 'admin' || user?.role === 'super_admin');
                          })() && (
                            <>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setCoverLetterCaseId(caseItem.id);
                                setCoverLetterModalOpen(true);
                              }}
                              className="flex items-center space-x-1 bg-purple-600 hover:bg-purple-700 text-white"
                              title={caseItem.cover_letter_form_exists ? "View Cover Letter" : "Fill Cover Letter"}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="hidden sm:inline">Cover Letter</span>
                              </Button>
                              {/* PDF Download Button - Show when cover letter form exists */}
                              {caseItem.cover_letter_form_exists && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadCoverLetterPDF(caseItem.id, caseItem.case_number)}
                                  className="flex items-center space-x-1 border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900"
                                  title="Download Cover Letter PDF"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="hidden sm:inline">PDF</span>
                            </Button>
                              )}
                            </>
                          )}
                          
                          {/* Welfare Department Actions */}
                          {/* Show approve/rework/checklist buttons if user has welfare_checklist:view permission AND case is submitted to welfare */}
                          {hasWelfareChecklistView && caseItem.status_name === 'submitted_to_welfare' && (
                            <>
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => handleWelfareApproval(caseItem.id)}
                                className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white"
                              >
                                <span>✓</span>
                                <span>Approve</span>
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleWelfareRework(caseItem.id)}
                                className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white"
                              >
                                <span>✗</span>
                                <span>Rework</span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenChecklist(caseItem.id)}
                                className="flex items-center space-x-1 border-blue-600 text-blue-600 hover:bg-blue-50"
                              >
                                <span>📋</span>
                                <span>Checklist</span>
                              </Button>
                            </>
                          )}

                          {/* Delete Confirmation Modal */}
                          <Modal
                            isOpen={deleteModalOpen}
                            onClose={() => {
                              setDeleteModalOpen(false);
                              setDeleteTarget(null);
                            }}
                            title="Delete Case"
                            size="md"
                          >
                            <div className="space-y-4">
                              <Alert severity="warning">
                                <p className="break-words whitespace-normal">
                                  Are you sure you want to delete case <strong>{deleteTarget?.caseNumber || ''}</strong>? This action cannot be undone.
                                </p>
                              </Alert>
                            </div>
                            <Modal.Footer>
                              <div className="flex space-x-3">
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setDeleteModalOpen(false);
                                    setDeleteTarget(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={() => deleteTarget && deleteCaseMutation.mutate(deleteTarget.id)}
                                  loading={deleteCaseMutation.isLoading}
                                >
                                  Delete
                                </Button>
                              </div>
                            </Modal.Footer>
                          </Modal>

                          {/* Case Closure Modal */}
                          <Modal
                            isOpen={closureModalOpen}
                            onClose={() => {
                              setClosureModalOpen(false);
                              setClosureTarget(null);
                              setClosureReason('');
                              setClosureDocument(null);
                              setClosureError('');
                            }}
                            title="Close Case"
                            size="md"
                          >
                            <div className="space-y-4">
                              {closureError && (
                                <Alert severity="error">
                                  <p className="break-words whitespace-normal">{closureError}</p>
                                </Alert>
                              )}
                              <Alert severity="warning">
                                <p className="break-words whitespace-normal">
                                  You are about to close case <strong>{closureTarget?.caseNumber || ''}</strong>. This will change the case status to <strong>Closed</strong>.
                                </p>
                              </Alert>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Reason for Closure <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                  value={closureReason}
                                  onChange={(e) => setClosureReason(e.target.value)}
                                  rows={4}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                  placeholder="Please provide a reason for closing this case..."
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Supporting Document <span className="text-gray-400">(Optional)</span>
                                </label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-primary-400 transition-colors">
                                  <div className="space-y-1 text-center">
                                    <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <div className="flex text-sm text-gray-600 justify-center">
                                      <label className="relative cursor-pointer rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none">
                                        <span>{closureDocument ? 'Change file' : 'Upload a file'}</span>
                                        <input
                                          type="file"
                                          className="sr-only"
                                          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                                          onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                              if (file.size > 10 * 1024 * 1024) {
                                                setClosureError('File size must be less than 10MB');
                                                return;
                                              }
                                              setClosureDocument(file);
                                              setClosureError('');
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                    <p className="text-xs text-gray-500">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG up to 10MB</p>
                                  </div>
                                </div>
                                {closureDocument && (
                                  <div className="mt-2 flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                                    <div className="flex items-center space-x-2">
                                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                      </svg>
                                      <span className="text-sm text-gray-700 truncate max-w-xs">{closureDocument.name}</span>
                                      <span className="text-xs text-gray-500">({(closureDocument.size / 1024).toFixed(1)} KB)</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setClosureDocument(null)}
                                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <Modal.Footer>
                              <div className="flex space-x-3">
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setClosureModalOpen(false);
                                    setClosureTarget(null);
                                    setClosureReason('');
                                    setClosureDocument(null);
                                    setClosureError('');
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={handleCloseCaseSubmit}
                                  loading={closeCaseMutation.isLoading}
                                  disabled={!closureReason.trim()}
                                >
                                  Close Case
                                </Button>
                              </div>
                            </Modal.Footer>
                          </Modal>

                          {/* Generic Permission-Based Workflow Actions */}
                          {/* These buttons appear based on workflow stage permissions, not hardcoded roles */}
                          {/* Only show if welfare-specific buttons are NOT showing (welfare has special checklist logic) */}
                          {caseItem.workflowPermissions?.can_approve && 
                           (() => {
                             const isExecutiveStage = caseItem.status_name?.startsWith('submitted_to_executive');
                             if (isExecutiveStage && caseItem.current_executive_level) {
                               // For executive stages: check level match or admin role
                               return user?.role === 'super_admin' || 
                                      user?.role === 'admin' || 
                                      user?.executive_level === caseItem.current_executive_level;
                             }
                             // For non-executive stages: always show if can_approve is true
                             return true;
                           })() &&
                           !(hasWelfareChecklistView && caseItem.status_name === 'submitted_to_welfare') && (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleWorkflowAction(caseItem.id, 'approve')}
                              className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white"
                            >
                              <span>✓</span>
                              <span>Approve</span>
                            </Button>
                          )}

                          {(Boolean(caseItem.workflowPermissions?.can_reject) || 
                           (() => {
                             const isExecutiveStage = caseItem.status_name?.startsWith('submitted_to_executive');
                             const userRole = user?.role;
                             const isExecutive = userRole === 'Executive Management' || userRole === 'super_admin';
                             if (isExecutiveStage && caseItem.current_executive_level && isExecutive) {
                               const levelMatches = userRole === 'super_admin' || 
                                                   user?.executive_level === caseItem.current_executive_level;
                               return levelMatches;
                             }
                             return false;
                           })()) && 
                           !(hasWelfareChecklistView && caseItem.status_name === 'submitted_to_welfare') && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleWorkflowAction(caseItem.id, 'reject')}
                              className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white"
                            >
                              <span>✗</span>
                              <span>Reject</span>
                            </Button>
                          )}

                          {/* Legacy: ZI Review Actions (keeping for backward compatibility) */}
                          {(() => {
                            const userRole = user?.role;
                            const isZI = userRole === 'ZI' || user?.role === 'super_admin';
                            const shouldShow = isZI && caseItem.status_name === 'submitted_to_zi' && !caseItem.workflowPermissions?.can_approve;
                            return shouldShow;
                          })() && (
                            <>
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => handleZiApproval(caseItem.id)}
                                className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white"
                              >
                                <span>✓</span>
                                <span>Approve</span>
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleZiReject(caseItem.id)}
                                className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white"
                              >
                                <span>✗</span>
                                <span>Reject</span>
                              </Button>
                            </>
                          )}

                          {/* Legacy: Executive Management Actions (keeping for backward compatibility) */}
                          {(() => {
                            const userRole = user?.role;
                            const isExecutive = userRole === 'Executive Management' || user?.role === 'super_admin';
                            const currentLevel = caseItem.current_executive_level;
                            const expectedStatus = `submitted_to_executive_${currentLevel}`;
                            const userLevel = user?.executive_level;
                            const levelMatches = user?.role === 'super_admin' || userLevel === currentLevel;
                            const shouldShow = isExecutive && caseItem.status_name === expectedStatus && levelMatches && !caseItem.workflowPermissions?.can_approve;
                            return shouldShow;
                          })() && (
                            <>
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => handleExecutiveApproval(caseItem.id)}
                                className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white"
                              >
                                <span>✓</span>
                                <span>Approve</span>
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleExecutiveRework(caseItem.id)}
                                className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 text-white"
                              >
                                <span>✗</span>
                                <span>Rework</span>
                              </Button>
                            </>
                          )}

                          {/* Welfare Forward Rework Actions */}
                          {(() => {
                            const userRole = user?.role?.toLowerCase();
                            const shouldShow = (userRole === 'welfare_reviewer' || userRole === 'welfare' || user?.role === 'super_admin') && caseItem.status_name === 'welfare_processing_rework';
                            return shouldShow;
                          })() && (
                            <Button
                              variant="warning"
                              size="sm"
                              onClick={() => handleWelfareForward(caseItem.id)}
                              className="flex items-center space-x-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                            >
                              <span>↻</span>
                              <span>Forward to DCM</span>
                            </Button>
                          )}

                          {/* DCM Actions for Rework Cases */}
                          {(() => {
                            const userRole = user?.role?.toLowerCase();
                            return (userRole === 'dcm' || user?.role === 'Deputy Counseling Manager' || user?.role === 'ZI' || user?.role === 'super_admin') && 
                                   caseItem.status_name === 'welfare_rejected' && 
                                   (caseItem.assigned_dcm_id === user?.id || user?.role === 'super_admin');
                          })() && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleResubmitToWelfare(caseItem.id)}
                              className="flex items-center space-x-1 bg-primary-600 hover:bg-primary-700 text-white"
                            >
                              <span>↻</span>
                              <span>Resubmit</span>
                            </Button>
                          )}

                          {/* Edit button - only for admin/super_admin */}
                          {(user?.role === 'admin' || user?.role === 'super_admin') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/cases/${caseItem.id}/edit`)}
                              className="flex items-center justify-center w-10 h-10 border-0 hover:bg-primary-50 text-gray-600 hover:text-primary-600"
                              title="Edit Case"
                            >
                              <EditIcon />
                            </Button>
                          )}
                          
                          {/* Assign Counselor button - based on permission */}
                          {canAssignCounselor && !caseItem.counselor_full_name && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignCounselorClick(caseItem.id)}
                              className="flex items-center justify-center px-3 py-2 border-0 hover:bg-blue-50 text-gray-600 hover:text-blue-600"
                              title="Assign Counselor"
                            >
                              <span className="text-xs font-medium">👤 Assign</span>
                            </Button>
                          )}
                          {canAssignCounselor && caseItem.counselor_full_name && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignCounselorClick(caseItem.id)}
                              className="flex items-center justify-center px-3 py-2 border-0 hover:bg-blue-50 text-gray-600 hover:text-blue-600"
                              title="Change Counselor"
                            >
                              <span className="text-xs font-medium">👤 Change</span>
                            </Button>
                          )}

                          {/* Manzoori button - visible in any stage for users with Manzoori Read permission when case has Manzoori files */}
                          {hasManzooriReadPermission &&
                            caseItem.manzoori_file_count > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleManzooriClick(caseItem.id)}
                                className="flex items-center justify-center px-3 py-2 border-0 hover:bg-green-50 text-gray-600 hover:text-green-700"
                                title="Open Manzoori PDF"
                              >
                                <span className="text-xs font-medium">📄 Manzoori</span>
                              </Button>
                            )}

                          {canCloseCase && caseItem.status_name !== 'closed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCloseCase(caseItem.id, caseItem.case_number)}
                              className="flex items-center justify-center px-3 py-2 border-0 hover:bg-orange-50 text-gray-600 hover:text-orange-600"
                              title="Close Case"
                            >
                              <span className="text-xs font-medium">🔒 Close</span>
                            </Button>
                          )}

                          {canDeleteCase && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteCase(caseItem.id, caseItem.case_number)}
                              className="flex items-center justify-center w-10 h-10 border-0 hover:bg-red-50 text-gray-600 hover:text-red-600"
                              title="Delete Case"
                            >
                              <DeleteIcon />
                            </Button>
                          )}
                        </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                  </table>
                </div>
              </div>

              {(!casesData?.cases || casesData.cases.length === 0) && (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">No cases found</h3>
                  <p className="text-gray-600 mb-6 text-lg">
                    {Object.values(filters).some(f => f) 
                      ? 'Try adjusting your search criteria or filters.'
                      : 'Get started by creating your first case.'
                    }
                  </p>
                  {(user?.role === 'admin' || user?.role === 'super_admin') && !Object.values(filters).some(f => f) && (
                    <Button 
                      onClick={() => setCreateModalOpen(true)}
                      className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      Create Case
                    </Button>
                  )}
                </div>
              )}

              {/* Pagination */}
              {casesData?.pagination?.pages > 1 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={page}
                    totalPages={casesData.pagination.pages}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Filter Modal */}
      <Modal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title="Filter Cases"
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Status"
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <Select.Option value="">All Statuses</Select.Option>
            <Select.Option value="draft">Draft</Select.Option>
            <Select.Option value="assigned">Assigned</Select.Option>
            <Select.Option value="in_counseling">In Counseling</Select.Option>
            <Select.Option value="cover_letter_generated">Cover Letter Generated</Select.Option>
            <Select.Option value="submitted_to_welfare">Submitted to Welfare</Select.Option>
            <Select.Option value="welfare_approved">Welfare Approved</Select.Option>
            <Select.Option value="welfare_rejected">Welfare Rework</Select.Option>
            <Select.Option value="executive_approved">Executive Approved</Select.Option>
            <Select.Option value="executive_rejected">Executive Rework</Select.Option>
            <Select.Option value="finance_disbursement">Finance Disbursement</Select.Option>
          </Select>

          <Select
            label="Case Type"
            value={filters.case_type}
            onChange={(e) => handleFilterChange('case_type', e.target.value)}
          >
            <Select.Option value="">All Types</Select.Option>
            {caseTypesData?.map((caseType) => (
              <Select.Option key={caseType.id} value={caseType.name}>
                {caseType.name}
              </Select.Option>
            ))}
          </Select>

          {/* Jamiat Filter */}
          <SearchableSelect
            label="Jamiat"
            value={filters.jamiat_id}
            onChange={(value) => {
              setFilterJamiatId(value);
              handleFilterChange('jamiat_id', value);
            }}
            placeholder="Select Jamiat..."
            options={jamiatData?.map(jamiat => ({
              value: jamiat.id,
              label: jamiat.name
            })) || []}
          />

          {/* Jamaat Filter - Only shown when Jamiat is selected */}
          {filterJamiatId && (
            <SearchableSelect
              label="Jamaat"
              value={filters.jamaat_id}
              onChange={(value) => {
                setFilterJamaatId(value);
                handleFilterChange('jamaat_id', value);
              }}
              placeholder="Select Jamaat..."
              options={filterJamaatData?.map(jamaat => ({
                value: jamaat.id,
                label: jamaat.name
              })) || []}
            />
          )}

          {/* Assign to Filter */}
          <SearchableSelect
            label="Assign to"
            value={filters.assigned_roles}
            onChange={(value) => handleFilterChange('assigned_roles', value)}
            placeholder="Select User..."
            options={filterUsersData?.map(user => ({
              value: user.id,
              label: `${user.full_name} - ${user.role}`
            })) || []}
          />

          {/* Counselor Filter */}
          <SearchableSelect
            label="Counselor"
            value={filters.assigned_counselor_id}
            onChange={(value) => handleFilterChange('assigned_counselor_id', value)}
            placeholder="Select Counselor..."
            options={allCounselorsData?.map(counselor => ({
              value: counselor.id,
              label: counselor.full_name
            })) || []}
          />

          {/* Case Stage Filter */}
          <SearchableSelect
            label="Case Stage"
            value={filters.current_workflow_stage_id}
            onChange={(value) => handleFilterChange('current_workflow_stage_id', value)}
            placeholder="Select Case Stage..."
            options={workflowStagesData?.map(stage => ({
              value: stage.id,
              label: stage.stage_name
            })) || []}
          />
        </div>

        <Modal.Footer>
          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={clearFilters}
            >
              Clear All
            </Button>
            <Button
              onClick={() => {
                setFilterModalOpen(false);
                refetch();
              }}
            >
              Apply Filters
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Case Registration Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={handleCreateModalClose}
        title="Case Registration"
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Information Section */}
          <div className="mb-8">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h4 className="text-lg font-medium text-gray-900">Personal Information</h4>
              <p className="text-sm text-gray-600 mt-1">Basic personal details of the applicant</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Input
                  label="ITS Number"
                  required
                  error={errors.its_number?.message}
                  {...register('its_number', { 
                    required: 'ITS number is required',
                    pattern: {
                      value: /^[0-9]{8}$/,
                      message: 'ITS number must be exactly 8 digits'
                    },
                    minLength: {
                      value: 8,
                      message: 'ITS number must be exactly 8 digits'
                    },
                    maxLength: {
                      value: 8,
                      message: 'ITS number must be exactly 8 digits'
                    }
                  })}
                  placeholder="Enter 8-digit ITS number"
                  maxLength={8}
                  onKeyDown={handleCreateItsNumberKeyDown}
                />
                <p className="text-xs text-gray-500">Data will be automatically fetched as you type (minimum 3 characters) or press Enter</p>
                {isCreateFetchingFromApi && (
                  <div className="text-sm text-blue-600 flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Fetching data from API...
                  </div>
                )}
              </div>
              
              <Input
                label="Full Name"
                required
                error={errors.full_name?.message}
                {...register('full_name', { 
                  required: 'Full name is required',
                  pattern: {
                    value: /^[A-Za-z\s]+$/,
                    message: 'Full name can only contain alphabets and spaces'
                  },
                  minLength: {
                    value: 2,
                    message: 'Full name must be at least 2 characters'
                  },
                  maxLength: {
                    value: 250,
                    message: 'Full name must not exceed 250 characters'
                  }
                })}
                placeholder="Enter full name (alphabets only)"
                maxLength={250}
              />
              
              <Input
                label="Age"
                type="number"
                error={errors.age?.message}
                {...register('age', {
                  min: {
                    value: 0,
                    message: 'Age must be at least 0'
                  },
                  max: {
                    value: 999,
                    message: 'Age must be less than 1000'
                  },
                  validate: (value) => {
                    if (!value) return true; // Optional field
                    if (isNaN(value) || value < 0 || value > 999) {
                      return 'Please enter a valid age (0-999)';
                    }
                    if (value.toString().length > 3) {
                      return 'Age must be maximum 3 digits';
                    }
                    return true;
                  }
                })}
                placeholder="Enter age (max 3 digits)"
                maxLength={3}
              />
            </div>
            
            {/* Photo Preview (from API) */}
            {createPhotoPreview && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photo (from API)
                </label>
                <img 
                  src={createPhotoPreview} 
                  alt="Applicant" 
                  className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
                />
              </div>
            )}
          </div>

          {/* Demographics Section */}
          <div className="mb-8">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h4 className="text-lg font-medium text-gray-900">Demographics</h4>
              <p className="text-sm text-gray-600 mt-1">Gender and marital status information</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Gender"
                error={errors.gender?.message}
                {...register('gender')}
              >
                <Select.Option value="">Select gender</Select.Option>
                <Select.Option value="male">Male</Select.Option>
                <Select.Option value="female">Female</Select.Option>
              </Select>
              
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="mb-8">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h4 className="text-lg font-medium text-gray-900">Contact Information</h4>
              <p className="text-sm text-gray-600 mt-1">Phone and email contact details</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Phone"
                type="tel"
                error={errors.phone?.message}
                {...register('phone', {
                  pattern: {
                    value: /^[\+]?[1-9][\d]{0,15}$/,
                    message: 'Please enter a valid phone number'
                  }
                })}
                placeholder="Enter phone number"
              />
              
              <Input
                label="Email"
                type="email"
                error={errors.email?.message}
                {...register('email', {
                  pattern: {
                    value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                    message: 'Please enter a valid email address'
                  },
                  validate: (value) => {
                    if (!value) return true; // Optional field
                    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                    if (!emailRegex.test(value)) {
                      return 'Please enter a valid email address';
                    }
                    return true;
                  }
                })}
                placeholder="Enter email address"
              />
            </div>
          </div>

          {/* Address Information Section */}
          <div className="mb-8">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h4 className="text-lg font-medium text-gray-900">Address Information</h4>
              <p className="text-sm text-gray-600 mt-1">Complete address details</p>
            </div>
            
            <div className="space-y-4">
              <Input
                label="Address"
                error={errors.address?.message}
                {...register('address')}
                placeholder="Enter full address"
              />
              
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Jamiat"
                    {...register('jamiat_name')}
                    readOnly
                    className="bg-gray-50"
                    placeholder="Will be filled from API"
                  />
                  
                  <Input
                    label="Jamaat"
                    {...register('jamaat_name')}
                    readOnly
                    className="bg-gray-50"
                    placeholder="Will be filled from API"
                  />
                </div>
              
            </div>
          </div>

          {/* Case Information Section */}
          <div className="mb-8 border-t border-gray-200 pt-6">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h4 className="text-lg font-medium text-gray-900">Case Information</h4>
              <p className="text-sm text-gray-600 mt-1">Case details for the new applicant</p>
            </div>

            {/* Case Type */}
            <div className="mb-6">
              <Select
                label="Case Type"
                required
                error={errors.case_type_id?.message}
                {...register('case_type_id', { 
                  required: 'Please select a case type' 
                })}
              >
                <Select.Option value="">Select case type</Select.Option>
                {caseTypesData?.map((caseType) => (
                  <Select.Option key={caseType.id} value={caseType.id}>
                    {caseType.name}
                  </Select.Option>
                ))}
              </Select>
            </div>

            {/* Case Description */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Case Description
                <span className="text-red-500 ml-1">*</span>
              </label>
              <textarea
                {...register('description', { 
                  required: 'Please provide a case description' 
                })}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.description ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                }`}
                placeholder="Describe the case details, requirements, and any relevant information..."
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            {/* Additional Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Any additional notes or special instructions..."
              />
            </div>
          </div>

          {/* Error/Success Messages */}
          {createError && (
            <Alert severity="error" className="mb-4">
              {createError}
            </Alert>
          )}

          {createApiError && (
            <Alert severity="error" className="mb-4">
              {createApiError}
            </Alert>
          )}

          {createSuccess && (
            <Alert severity="success" className="mb-4">
              {createSuccess}
            </Alert>
          )}

          {/* Modal Footer */}
          <Modal.Footer>
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCreateModalClose}
                disabled={createApplicantMutation.isLoading || createCaseMutation.isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createApplicantMutation.isLoading || createCaseMutation.isLoading}
                disabled={createApplicantMutation.isLoading || createCaseMutation.isLoading}
              >
                {(createApplicantMutation.isLoading || createCaseMutation.isLoading) 
                  ? 'Creating Applicant & Case...' 
                  : 'Create Case'}
              </Button>
            </div>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Welfare Approval Modal */}
      <Modal
        isOpen={welfareApprovalModalOpen}
        onClose={() => {
          setWelfareApprovalModalOpen(false);
          setChecklistError(''); // Clear error when modal closes
        }}
        title="Approve Case"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to approve this case? You can add optional comments below.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comments (Optional)
            </label>
            <textarea
              value={welfareComments}
              onChange={(e) => setWelfareComments(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={4}
              placeholder="Add any comments about the approval..."
            />
          </div>
        </div>
        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setWelfareApprovalModalOpen(false)}
            disabled={welfareApprovalMutation.isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="success"
            onClick={handleWelfareApprovalSubmit}
            loading={welfareApprovalMutation.isLoading}
            disabled={welfareApprovalMutation.isLoading}
          >
            {welfareApprovalMutation.isLoading ? 'Approving...' : 'Approve Case'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Welfare Rework Modal */}
      <Modal
        isOpen={welfareReworkModalOpen}
        onClose={() => setWelfareReworkModalOpen(false)}
        title="Rework Case"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Please provide a reason for sending this case back for rework. This will help the assigned user understand what needs to be changed.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rework Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={welfareComments}
              onChange={(e) => setWelfareComments(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={4}
              placeholder="Please explain why this case needs rework and what needs to be changed..."
              required
            />
          </div>
        </div>
        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setWelfareReworkModalOpen(false)}
            disabled={welfareReworkMutation.isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleWelfareReworkSubmit}
            loading={welfareReworkMutation.isLoading}
            disabled={welfareReworkMutation.isLoading || !welfareComments.trim()}
          >
            {welfareReworkMutation.isLoading ? 'Sending for Rework...' : 'Send for Rework'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Welfare Checklist Modal */}
      <Modal
        isOpen={checklistModalOpen}
        onClose={() => {
          setChecklistModalOpen(false);
          setSelectedCaseId(null);
        }}
        title="Welfare Checklist"
        size="xl"
        className="max-w-6xl"
      >
        <div className="max-h-[70vh] overflow-y-auto">
          {selectedCaseId && (() => {
            // Get case status for the selected case
            const selectedCase = casesData?.cases?.find(c => c.id === selectedCaseId);
            const selectedCaseStatus = selectedCase?.status_name;
            
            return (
              <WelfareChecklistForm 
                caseId={selectedCaseId} 
                isViewOnly={
                  !(hasWelfareChecklistCreate || hasWelfareChecklistUpdate || hasWelfareChecklistAll || user?.role === 'admin' || user?.role === 'super_admin')
                }
                caseStatus={selectedCaseStatus}
                onExposeSubmit={setChecklistSubmitHandler}
                onSuccess={() => {
                  // Refresh cases list after successful submit
                  refetch();
                  queryClient.invalidateQueries(['cases']);
                }}
              />
            );
          })()}
        </div>
        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setChecklistModalOpen(false);
              setSelectedCaseId(null);
              setChecklistSubmitHandler(null); // Reset submit handler
              queryClient.invalidateQueries(['cases']); // Refresh list when closing
            }}
          >
            Close
          </Button>
          {checklistSubmitHandler?.canSubmit && (
            <Button
              type="button"
              variant="success"
              onClick={() => checklistSubmitHandler?.submit()}
              loading={checklistSubmitHandler?.isSubmitting}
              disabled={checklistSubmitHandler?.isSubmitting}
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              {checklistSubmitHandler?.isSubmitting ? 'Submitting...' : 'Submit Checklist'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Cover Letter Modal */}
      <Modal
        isOpen={coverLetterModalOpen}
        onClose={() => {
          setCoverLetterModalOpen(false);
          setCoverLetterCaseId(null);
          setCoverLetterSubmitHandler(null);
        }}
        title="Cover Letter"
        size="xl"
        className="max-w-6xl"
      >
        <div className="max-h-[70vh] overflow-y-auto">
          {coverLetterCaseId && (() => {
            // Get case details to determine if form should be view-only
            const selectedCase = casesData?.cases?.find(c => c.id === coverLetterCaseId);
            const isCoverLetterApproved = !!selectedCase?.cover_letter_form_approved;
            
            // IMPORTANT:
            // Cover letter stays editable in any workflow stage until it is approved.
            // Once approved, lock for everyone except super_admin.
            const shouldBeViewOnly = isCoverLetterApproved && user?.role !== 'super_admin';
            
            return (
              <CoverLetterForm 
                caseId={coverLetterCaseId} 
                isViewOnly={shouldBeViewOnly}
                onExposeSubmit={setCoverLetterSubmitHandler}
                onSuccess={() => {
                  // Refresh cases list after successful submit
                  refetch();
                  queryClient.invalidateQueries(['cases']);
                  setCoverLetterModalOpen(false);
                  setCoverLetterCaseId(null);
                }}
              />
            );
          })()}
        </div>
        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setCoverLetterModalOpen(false);
              setCoverLetterCaseId(null);
              setCoverLetterSubmitHandler(null);
              queryClient.invalidateQueries(['cases']);
            }}
          >
            Close
          </Button>
          {coverLetterSubmitHandler?.canSubmit && (
            <Button
              type="button"
              variant="primary"
              onClick={() => coverLetterSubmitHandler?.submit()}
              loading={coverLetterSubmitHandler?.isSubmitting}
              disabled={coverLetterSubmitHandler?.isSubmitting}
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              {coverLetterSubmitHandler?.isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Resubmit to Welfare Modal */}
      <Modal
        isOpen={resubmitModalOpen}
        onClose={() => setResubmitModalOpen(false)}
        title="Resubmit Case to Welfare Department"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            You are resubmitting this case to the welfare department after addressing their feedback. You can add comments about the changes made.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comments (Optional)
            </label>
            <textarea
              value={welfareComments}
              onChange={(e) => setWelfareComments(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={4}
              placeholder="Describe the changes made to address the welfare department feedback..."
            />
          </div>
        </div>
        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setResubmitModalOpen(false)}
            disabled={resubmitToWelfareMutation.isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleResubmitSubmit}
            loading={resubmitToWelfareMutation.isLoading}
            disabled={resubmitToWelfareMutation.isLoading}
          >
            {resubmitToWelfareMutation.isLoading ? 'Resubmitting...' : 'Resubmit Case'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ZI Approval Modal */}
      <Modal
        isOpen={ziApprovalModalOpen}
        onClose={() => {
          setZiApprovalModalOpen(false);
          setZiComments('');
        }}
        title="Approve Case - ZI Review"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to approve this case? You can add optional comments below.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comments (Optional)
            </label>
            <textarea
              value={ziComments}
              onChange={(e) => setZiComments(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={4}
              placeholder="Add any comments about the approval..."
            />
          </div>
        </div>
        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setZiApprovalModalOpen(false);
              setZiComments('');
            }}
            disabled={ziApprovalMutation.isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="success"
            onClick={handleZiApprovalSubmit}
            loading={ziApprovalMutation.isLoading}
            disabled={ziApprovalMutation.isLoading}
          >
            {ziApprovalMutation.isLoading ? 'Approving...' : 'Approve Case'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ZI Reject Modal */}
      <Modal
        isOpen={ziRejectModalOpen}
        onClose={() => {
          setZiRejectModalOpen(false);
          setZiComments('');
        }}
        title="Reject Case - ZI Review"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Please provide a reason for rejecting this case. This will be sent back to the welfare department for review.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={ziComments}
              onChange={(e) => setZiComments(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={4}
              placeholder="Please explain why this case is being rejected and what needs to be changed..."
              required
            />
          </div>
        </div>
        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setZiRejectModalOpen(false);
              setZiComments('');
            }}
            disabled={ziRejectMutation.isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleZiRejectSubmit}
            loading={ziRejectMutation.isLoading}
            disabled={ziRejectMutation.isLoading || !ziComments.trim()}
          >
            {ziRejectMutation.isLoading ? 'Rejecting...' : 'Reject Case'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Generic Workflow Action Modal */}
      <Modal
        isOpen={workflowActionModalOpen}
        onClose={() => {
          setWorkflowActionModalOpen(false);
          setWorkflowComments('');
          setWorkflowActionType(null);
        }}
        title={workflowActionType === 'approve' ? 'Approve Case' : 'Reject Case'}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            {workflowActionType === 'approve' 
              ? 'Are you sure you want to approve this case? You can add optional comments below.'
              : 'Please provide a reason for rejecting this case. Comments are required.'}
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comments {workflowActionType === 'reject' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={workflowComments}
              onChange={(e) => setWorkflowComments(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={4}
              placeholder={workflowActionType === 'approve' 
                ? 'Add any comments about the approval...'
                : 'Please explain why this case is being rejected...'}
              required={workflowActionType === 'reject'}
            />
          </div>
        </div>
        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setWorkflowActionModalOpen(false);
              setWorkflowComments('');
              setWorkflowActionType(null);
            }}
            disabled={workflowActionMutation.isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={workflowActionType === 'approve' ? 'success' : 'danger'}
            onClick={handleWorkflowActionSubmit}
            loading={workflowActionMutation.isLoading}
            disabled={workflowActionMutation.isLoading || (workflowActionType === 'reject' && !workflowComments.trim())}
          >
            {workflowActionMutation.isLoading 
              ? (workflowActionType === 'approve' ? 'Approving...' : 'Rejecting...')
              : (workflowActionType === 'approve' ? 'Approve Case' : 'Reject Case')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Executive Approval Modal */}
      <Modal
        isOpen={executiveApprovalModalOpen}
        onClose={() => setExecutiveApprovalModalOpen(false)}
        title="Approve Case - Executive Management"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to approve this case? You can add optional comments below.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comments (Optional)
            </label>
            <textarea
              value={executiveComments}
              onChange={(e) => setExecutiveComments(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={4}
              placeholder="Add any comments about the approval..."
            />
          </div>
        </div>
        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setExecutiveApprovalModalOpen(false)}
            disabled={executiveApprovalMutation.isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="success"
            onClick={handleExecutiveApprovalSubmit}
            loading={executiveApprovalMutation.isLoading}
            disabled={executiveApprovalMutation.isLoading}
          >
            {executiveApprovalMutation.isLoading ? 'Approving...' : 'Approve Case'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Executive Rework Modal */}
      <Modal
        isOpen={executiveReworkModalOpen}
        onClose={() => setExecutiveReworkModalOpen(false)}
        title="Send Case for Rework - Executive Management"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Please provide a reason for sending this case back for rework. This will be forwarded to the welfare department for review.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rework Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={executiveComments}
              onChange={(e) => setExecutiveComments(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={4}
              placeholder="Please explain why this case needs rework and what needs to be changed..."
              required
            />
          </div>
        </div>
        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setExecutiveReworkModalOpen(false)}
            disabled={executiveReworkMutation.isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleExecutiveReworkSubmit}
            loading={executiveReworkMutation.isLoading}
            disabled={executiveReworkMutation.isLoading || !executiveComments.trim()}
          >
            {executiveReworkMutation.isLoading ? 'Sending for Rework...' : 'Send for Rework'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Welfare Forward Rework Modal */}
      <Modal
        isOpen={welfareForwardModalOpen}
        onClose={() => setWelfareForwardModalOpen(false)}
        title="Forward Rework to DCM - Welfare Department"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Please review the executive feedback and provide your consolidated comments to forward to the DCM for rework.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Consolidated Comments <span className="text-red-500">*</span>
            </label>
            <textarea
              value={welfareComments}
              onChange={(e) => setWelfareComments(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={4}
              placeholder="Provide consolidated feedback for the DCM based on executive comments..."
              required
            />
          </div>
        </div>
        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setWelfareForwardModalOpen(false)}
            disabled={welfareForwardMutation.isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="warning"
            onClick={handleWelfareForwardSubmit}
            loading={welfareForwardMutation.isLoading}
            disabled={welfareForwardMutation.isLoading || !welfareComments.trim()}
          >
            {welfareForwardMutation.isLoading ? 'Forwarding...' : 'Forward to DCM'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Assign Case Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setAssigningCaseId(null);
          setAssignSelectedRoleId('');
          setAssignSelectedCounselorId('');
        }}
        title="Assign Case"
        size="lg"
      >
        <div className="space-y-4">
          <Select
            label="Role"
            value={assignSelectedRoleId}
            onChange={(e) => {
              setAssignSelectedRoleId(e.target.value);
              setAssignSelectedCounselorId(''); // Reset user when role changes
            }}
            required
          >
            <Select.Option value="">Select Role</Select.Option>
            {assignRolesData?.filter(role => role.is_active).map((role) => (
              <Select.Option key={role.id} value={role.name}>
                {role.name}
              </Select.Option>
            ))}
          </Select>

          <SearchableSelect
            label="Assign To"
            value={assignSelectedCounselorId}
            onChange={(value) => setAssignSelectedCounselorId(value)}
            placeholder="Unassigned"
            required
            disabled={!assignSelectedRoleId}
            options={[
              { value: '', label: 'Unassigned' },
              ...(assignUsersData || [])
                .map((user) => ({
                  value: user.id,
                  label: user.its_number 
                    ? `${user.full_name || user.username} - (${user.its_number})`
                    : (user.full_name || user.username)
                }))
                .sort((a, b) => {
                  const labelA = (a.label || '').toLowerCase();
                  const labelB = (b.label || '').toLowerCase();
                  return labelA.localeCompare(labelB);
                })
            ]}
          />

          <Alert severity="info">
            Assigning a user will automatically change the case status to "Assigned" when both role and user are selected.
          </Alert>
        </div>

        <Modal.Footer>
          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={() => {
                setAssignModalOpen(false);
                setAssigningCaseId(null);
                setAssignSelectedRoleId('');
                setAssignSelectedCounselorId('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignCase}
              loading={assignCaseMutation.isLoading}
              disabled={!assignSelectedRoleId || !assignSelectedCounselorId || assignCaseMutation.isLoading}
            >
              Assign Case
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Assign Counselor Modal */}
      <Modal
        isOpen={counselorAssignModalOpen}
        onClose={() => {
          setCounselorAssignModalOpen(false);
          setAssigningCounselorCaseId(null);
          setSelectedCounselorId('');
          setCounselorSearchTerm('');
        }}
        title="Assign Counselor"
        size="md"
      >
        <div className="space-y-4">
          <Alert severity="info">
            Select a counselor from the available list. Counselors are filtered by the case's location (Jamiat/Jamaat) and must be assigned to the Counselor workflow stage.
          </Alert>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Counselor
            </label>
            <Input
              type="text"
              placeholder="Search by name or email..."
              value={counselorSearchTerm}
              onChange={(e) => setCounselorSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <Select
              label="Select Counselor"
              value={selectedCounselorId}
              onChange={(e) => setSelectedCounselorId(e.target.value)}
              required
            >
              <Select.Option value="unassign">Unassign Counselor</Select.Option>
              {availableCounselorsData
                ?.filter(counselor => {
                  if (!counselorSearchTerm) return true;
                  const search = counselorSearchTerm.toLowerCase();
                  return (
                    counselor.full_name?.toLowerCase().includes(search) ||
                    counselor.email?.toLowerCase().includes(search)
                  );
                })
                .map((counselor) => (
                  <Select.Option key={counselor.id} value={counselor.id}>
                    {counselor.full_name} {counselor.email && `(${counselor.email})`}
                  </Select.Option>
                ))}
            </Select>
          </div>

          {availableCounselorsData && availableCounselorsData.length === 0 && (
            <Alert severity="warning">
              <div className="space-y-2">
                <p className="font-semibold">No counselors available for this case.</p>
                <p className="text-sm">Possible reasons:</p>
                <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                  <li>No counselors are assigned to the Counselor workflow stage</li>
                  <li>No counselors match this case's location (Jamiat/Jamaat)</li>
                  <li>The case doesn't have a Jamiat/Jamaat assigned</li>
                </ul>
                <p className="text-sm mt-2">
                  <strong>To fix:</strong> Go to Workflow Stages → Counselor Stage → Users button, and add counselors there.
                </p>
              </div>
            </Alert>
          )}

          {availableCounselorsData && availableCounselorsData.length > 0 && (
            <div className="text-sm text-gray-600">
              {availableCounselorsData.length} counselor(s) available
            </div>
          )}
        </div>

        <Modal.Footer>
          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={() => {
                setCounselorAssignModalOpen(false);
                setAssigningCounselorCaseId(null);
                setSelectedCounselorId('');
                setCounselorSearchTerm('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignCounselor}
              loading={assignCounselorMutation.isLoading}
              disabled={!selectedCounselorId || assignCounselorMutation.isLoading || assignCounselorMutation.isSuccess}
            >
              {assignCounselorMutation.isLoading 
                ? 'Assigning...' 
                : selectedCounselorId === 'unassign' 
                  ? 'Unassign' 
                  : 'Assign Counselor'}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Cases;