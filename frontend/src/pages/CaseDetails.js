import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { usePermission } from '../utils/permissionUtils';
import { 
  Button, 
  Card, 
  Chip, 
  Alert,
  Modal,
  Select,
  Input,
  SearchableSelect
} from '../components/ui';
import WelfareChecklistForm from '../components/WelfareChecklistForm';

// Icon components
const ArrowLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

// Manzoori Upload Section Component
const ManzooriUploadSection = ({ caseId, canEdit: workflowCanEdit, canView: workflowCanView }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  // Fetch counseling form stage permissions as fallback (for Role Management configuration)
  const { data: counselingFormData } = useQuery(
    ['counseling-form-stage-permissions', caseId],
    () => axios.get(`/api/counseling-forms/case/${caseId}`).then(res => res.data),
    {
      enabled: !!caseId,
      retry: false,
      // Don't fail if form doesn't exist - we just need permissions
      onError: () => {},
    }
  );

  // Get manzoori permissions from counseling form stage permissions (fallback)
  const manzooriStagePerms = counselingFormData?.stage_permissions?.manzoori;
  const counselingFormCanEdit = manzooriStagePerms?.can_update === true;
  const counselingFormCanView = manzooriStagePerms?.can_read === true; // Require explicit Read permission

  // Use workflow permissions first, fallback to counseling form stage permissions
  // For viewing: require explicit permission (either workflow can_view OR counseling form can_read)
  const canEdit = workflowCanEdit || counselingFormCanEdit || false;
  const canView = workflowCanView === true || counselingFormCanView || false; // Require explicit Read permission

  // Fetch attachments for this case (must be called before conditional return)
  const { data: attachmentsData, isLoading: attachmentsLoading, refetch: refetchAttachments } = useQuery(
    ['case-attachments', caseId],
    () => axios.get(`/api/attachments/case/${caseId}`).then(res => res.data),
    {
      enabled: !!caseId && canView,
      retry: false,
    }
  );

  // Hide entire component if user doesn't have Read permission
  if (!canView) {
    return null;
  }

  // Filter for manzoori stage files
  const manzooriFiles = attachmentsData?.attachments?.filter(
    (file) => file.stage === 'manzoori'
  ) || [];

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, JPG, and PNG files are allowed.');
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setUploadError('File size exceeds maximum allowed size of 10MB.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('stage', 'manzoori');

      await axios.post(`/api/attachments/upload/${caseId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadSuccess('File uploaded successfully!');
      queryClient.invalidateQueries(['case-attachments', caseId]);
      queryClient.invalidateQueries(['case', caseId]);
      
      // Clear success message after 3 seconds
      setTimeout(() => setUploadSuccess(''), 3000);
      
      // Reset file input
      event.target.value = '';
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(
        error.response?.data?.error || 
        error.message || 
        'Failed to upload file. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  // Handle file delete
  const handleDeleteFile = async (attachmentId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      await axios.delete(`/api/attachments/${attachmentId}`);
      queryClient.invalidateQueries(['case-attachments', caseId]);
      queryClient.invalidateQueries(['case', caseId]);
      setUploadSuccess('File deleted successfully!');
      setTimeout(() => setUploadSuccess(''), 3000);
    } catch (error) {
      console.error('Delete error:', error);
      setUploadError(
        error.response?.data?.error || 
        error.message || 
        'Failed to delete file. Please try again.'
      );
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Manzoori Upload</h3>
          {canEdit && (
            <div className="flex items-center space-x-2">
              <input
                type="file"
                id="manzoori-file-input"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => document.getElementById('manzoori-file-input')?.click()}
                disabled={uploading}
                loading={uploading}
                className="flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
              </Button>
            </div>
          )}
        </div>
      </Card.Header>
      <Card.Content>
        {uploadError && (
          <Alert severity="error" className="mb-4" onClose={() => setUploadError('')}>
            {uploadError}
          </Alert>
        )}
        {uploadSuccess && (
          <Alert severity="success" className="mb-4" onClose={() => setUploadSuccess('')}>
            {uploadSuccess}
          </Alert>
        )}

        <p className="text-sm text-gray-600 mb-4">
          Upload the manzoori document received for this case. Only authorized users can upload files.
        </p>

        {attachmentsLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          </div>
        ) : manzooriFiles.length > 0 ? (
          <div className="space-y-3">
            {manzooriFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.file_name}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>Uploaded by {file.uploaded_by_name || file.uploaded_by_full_name || 'Unknown'}</span>
                      <span>{formatDate(file.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.open(`/api/attachments/download/${file.id}`, '_blank');
                    }}
                    className="flex items-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download</span>
                  </Button>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteFile(file.id)}
                      className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">No manzoori files uploaded yet</p>
            {!canEdit && (
              <p className="text-xs mt-1">You don't have permission to upload files</p>
            )}
          </div>
        )}
      </Card.Content>
    </Card>
  );
};

// Comments Section Component
const CommentsSection = ({ caseId }) => {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState('general');
  const queryClient = useQueryClient();

  // Fetch comments
  const { data: commentsData, isLoading: commentsLoading } = useQuery(
    ['case-comments', caseId],
    () => axios.get(`/api/cases/${caseId}/comments`).then(res => res.data),
    { enabled: !!caseId }
  );

  // Add comment mutation
  const addCommentMutation = useMutation(
    ({ comment, comment_type }) => 
      axios.post(`/api/cases/${caseId}/comments`, { comment, comment_type }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['case-comments', caseId]);
        setNewComment('');
        setCommentType('general');
      },
    }
  );

  const handleAddComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate({
        comment: newComment.trim(),
        comment_type: commentType
      });
    }
  };

  const getCommentTypeColor = (type) => {
    switch (type) {
      case 'approval': return 'success';
      case 'rework': return 'error';
      case 'note': return 'info';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Comment Form */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Add Comment</h4>
        <div className="space-y-3">
          <select
            value={commentType}
            onChange={(e) => setCommentType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="general">General Comment</option>
            <option value="note">Note</option>
            <option value="approval">Approval</option>
            <option value="rework">Rework</option>
          </select>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add your comment..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={3}
          />
          <Button
            onClick={handleAddComment}
            disabled={!newComment.trim() || addCommentMutation.isLoading}
            loading={addCommentMutation.isLoading}
            size="sm"
          >
            Add Comment
          </Button>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-3">
        {commentsLoading ? (
          <div className="text-center py-4 text-gray-500">Loading comments...</div>
        ) : commentsData?.comments?.length > 0 ? (
          commentsData.comments.map((comment) => (
            <div key={comment.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">
                    {comment.first_name} {comment.last_name}
                  </span>
                  <Chip variant={getCommentTypeColor(comment.comment_type)} size="sm">
                    {comment.comment_type}
                  </Chip>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(comment.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-gray-500">No comments yet</div>
        )}
      </div>
    </div>
  );
};

const CaseDetails = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Check if user has permission to view welfare checklist
  const { hasPermission: hasWelfareChecklistView } = usePermission('welfare_checklist', 'view');
  const { hasPermission: hasWelfareChecklistCreate } = usePermission('welfare_checklist', 'create');
  const { hasPermission: hasWelfareChecklistUpdate } = usePermission('welfare_checklist', 'update');
  // Check if user has permission to assign cases
  const { hasPermission: canAssignCase } = usePermission('cases', 'assign_case');
  // Check if user has permission to assign counselors
  const { hasPermission: canAssignCounselor } = usePermission('cases', 'assign_counselor');
  // Check if user has permission to change assignee (reassignment)
  const { hasPermission: canChangeAssignee } = usePermission('cases', 'change_assignee');
  // Payment management permissions
  const { hasPermission: hasPaymentManagementRead } = usePermission('payment_management', 'read');
  
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignModalMode, setAssignModalMode] = useState('assign'); // 'assign' | 'reassign'
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedCounselorId, setSelectedCounselorId] = useState('');
  // Counselor assignment modal state
  const [counselorAssignModalOpen, setCounselorAssignModalOpen] = useState(false);
  const [counselorModalMode, setCounselorModalMode] = useState('assign'); // 'assign' | 'reassign'
  const [selectedCounselorIdForAssignment, setSelectedCounselorIdForAssignment] = useState('');

  const { data: caseData, isLoading, error } = useQuery(
    ['case', caseId],
    () => axios.get(`/api/cases/${caseId}`).then(res => res.data),
    {
      enabled: !!caseId,
      refetchOnMount: true,
    }
  );

  // Fetch users for assignment (high limit so all users for the role appear in Assign To dropdown)
  const { data: usersData } = useQuery(
    ['users', selectedRoleId],
    () => {
      const params = {};
      if (selectedRoleId) params.role = selectedRoleId;
      params.is_active = 'true';
      params.limit = 500;
      params.page = 1;
      return axios.get('/api/users', { params }).then(res => res.data);
    },
    {
      select: (data) => data.users || [],
      enabled: !!selectedRoleId,
    }
  );

  // Fetch available counselors for assignment
  const { data: availableCounselorsData } = useQuery(
    ['available-counselors', caseId],
    () => {
      const params = {};
      if (caseId) params.caseId = caseId;
      return axios.get('/api/cases/available-counselors', { params }).then(res => res.data);
    },
    {
      select: (data) => data.counselors || [],
      enabled: !!caseId && counselorAssignModalOpen,
    }
  );

  // Fetch roles
  const { data: rolesData } = useQuery(
    'roles',
    () => axios.get('/api/users/roles').then(res => res.data),
    {
      select: (data) => data.roles || [],
    }
  );

  const assignCaseMutation = useMutation(
    ({ caseId, assigned_roles, assigned_counselor_id }) => {
      const body = { assigned_roles };
      if (assigned_counselor_id !== undefined) body.assigned_counselor_id = assigned_counselor_id;
      return axios.put(`/api/cases/${caseId}`, body);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['case', caseId]);
        setAssignModalOpen(false);
        setAssignModalMode('assign');
        setSelectedRoleId('');
        setSelectedCounselorId('');
      },
    }
  );

  // Assign counselor mutation
  const assignCounselorMutation = useMutation(
    ({ caseId, assigned_counselor_id }) =>
      axios.put(`/api/cases/${caseId}`, { assigned_counselor_id }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['case', caseId]);
        queryClient.invalidateQueries(['available-counselors', caseId]);
        setCounselorAssignModalOpen(false);
        setSelectedCounselorIdForAssignment('');
      },
      onError: (error) => {
        console.error('Assign counselor error:', error);
      },
    }
  );

  const handleAssignCase = () => {
    if (selectedRoleId && selectedCounselorId) {
      assignCaseMutation.mutate({
        caseId,
        assigned_roles: selectedCounselorId, // Assign To = DCM user ID
        assigned_counselor_id: assignModalMode === 'reassign' ? undefined : null,
      });
    }
  };

  // Handler for assigning counselor to case
  const handleAssignCounselor = () => {
    if (selectedCounselorIdForAssignment && caseId) {
      assignCounselorMutation.mutate({
        caseId,
        assigned_counselor_id: selectedCounselorIdForAssignment === 'unassign' ? null : selectedCounselorIdForAssignment,
      });
    }
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
      executive_approved: 'success',
      executive_rejected: 'error',
      finance_disbursement: 'success',
    };
    return statusColors[status] || 'default';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    // Parse the date string
    // Backend now returns dates as ISO 8601 strings (e.g., "2025-11-06T17:36:00.000Z")
    // This ensures proper timezone handling
    let date;
    try {
      if (typeof dateString === 'string') {
        // If it's already an ISO string (contains 'T'), parse directly
        // Backend now returns dates as "YYYY-MM-DDTHH:MM:SS" format
        if (dateString.includes('T')) {
          // If it has 'Z' or timezone, parse as-is. Otherwise, treat as local time
          if (dateString.includes('Z') || dateString.match(/[+-]\d{2}:\d{2}$/)) {
            date = new Date(dateString);
          } else {
            // No timezone info - parse as local time (exact date/time from database)
            date = new Date(dateString);
          }
        } else {
          // Legacy format: "YYYY-MM-DD HH:MM:SS" - convert to ISO format
          const isoString = dateString.replace(' ', 'T');
          date = new Date(isoString);
        }
      } else {
        date = new Date(dateString);
      }
      
      // Validate the date
      if (isNaN(date.getTime())) {
        console.error('Invalid date string:', dateString);
        return 'Invalid Date';
      }
      
      // Format in user's local timezone
      const datePart = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const timePart = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return `${datePart} at ${timePart}`;
    } catch (error) {
      console.error('Error parsing date:', dateString, error);
      return 'Invalid Date';
    }
  };

  const formatStatus = (status) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert severity="error">
          Error loading case: {error.message}
        </Alert>
      </div>
    );
  }

  if (!caseData?.case) {
    return (
      <div className="p-6">
        <Alert severity="error">
          Case not found
        </Alert>
      </div>
    );
  }

  const caseItem = caseData.case;

  // Check if case is unassigned
  const isUnassigned = !caseItem?.roles || !caseItem?.assigned_counselor_id;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => navigate(`/cases?search=${encodeURIComponent(caseItem.case_number || '')}`)}
              className="flex items-center space-x-2"
            >
              <ArrowLeftIcon />
              <span>Back to Cases</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Case {caseItem.case_number}
              </h1>
              <p className="text-gray-600">
                Created on {formatDate(caseItem.created_at)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Chip variant={getStatusColor(caseItem.status_name)}>
              {formatStatus(caseItem.status_name)}
            </Chip>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Case Information */}
          <Card>
            <Card.Header>
              <h3 className="text-lg font-semibold text-gray-900">Case Information</h3>
            </Card.Header>
            <Card.Content>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Case Type
                  </label>
                  <p className="text-sm text-gray-900">
                    {caseItem.case_type_name || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Assigned To
                  </label>
                  <div className="flex items-center space-x-2 flex-wrap gap-2">
                    <p className="text-sm text-gray-900">
                      {caseItem.dcm_full_name || caseItem.counselor_full_name || 'Unassigned'}
                    </p>
                    {(canAssignCase || canAssignCounselor || canChangeAssignee) && (
                      <>
                        {canAssignCase && isUnassigned && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setAssignModalMode('assign');
                              setAssignModalOpen(true);
                            }}
                          >
                            Assign Case
                          </Button>
                        )}
                        {canChangeAssignee && caseItem?.roles && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAssignModalMode('reassign');
                              setAssignModalOpen(true);
                            }}
                          >
                            Change assignee
                          </Button>
                        )}
                        {canAssignCounselor && !caseItem?.assigned_counselor_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCounselorModalMode('assign');
                              setCounselorAssignModalOpen(true);
                              setSelectedCounselorIdForAssignment('');
                            }}
                          >
                            Assign Counselor
                          </Button>
                        )}
                        {canChangeAssignee && caseItem?.assigned_counselor_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCounselorModalMode('reassign');
                              setCounselorAssignModalOpen(true);
                              setSelectedCounselorIdForAssignment(caseItem.assigned_counselor_id || '');
                            }}
                          >
                            Change Counselor
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Last Updated
                  </label>
                  <p className="text-sm text-gray-900">
                    {formatDate(caseItem.updated_at)}
                  </p>
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* Description */}
          <Card>
            <Card.Header>
              <h3 className="text-lg font-semibold text-gray-900">Description</h3>
            </Card.Header>
            <Card.Content>
              <p className="text-gray-700 whitespace-pre-wrap">
                {caseItem.description || 'No description provided'}
              </p>
            </Card.Content>
          </Card>

          {/* Notes */}
          {caseItem.notes && (
            <Card>
              <Card.Header>
                <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
              </Card.Header>
              <Card.Content>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {caseItem.notes}
                </p>
              </Card.Content>
            </Card>
          )}

          {/* Welfare Checklist Form - Show during welfare review stage */}
          {/* Show if user has view permission AND case is in appropriate status */}
          {(hasWelfareChecklistView && (caseItem.status_name === 'submitted_to_welfare' || 
            caseItem.status_name === 'welfare_approved' || 
            caseItem.status_name?.startsWith('submitted_to_executive') ||
            caseItem.status_name === 'executive_approved' ||
            caseItem.status_name === 'executive_rejected' ||
            caseItem.status_name === 'finance_disbursement')) && (
            <WelfareChecklistForm 
              caseId={caseId} 
              isViewOnly={
                caseItem.status_name !== 'submitted_to_welfare' ||
                !(hasWelfareChecklistCreate || hasWelfareChecklistUpdate || user?.role === 'admin' || user?.role === 'super_admin')
              }
            />
          )}

          {/* Payment Schedule Action Button - Show during finance disbursement stage when user has payment management permission */}
          {(caseItem.status_name === 'finance_disbursement' || 
            caseItem.current_workflow_stage_name === 'Finance Disbursement') &&
            hasPaymentManagementRead && (
            <Card>
              <Card.Header>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Payment Schedule</h3>
                  <Button
                    variant="primary"
                    onClick={() => navigate(`/cases/${caseId}/payment-schedule`)}
                  >
                    Manage Payment Schedule
                  </Button>
                </div>
              </Card.Header>
              <Card.Content>
                <p className="text-sm text-gray-600 mb-4">
                  Manage Qardan Hasana and Enayat payment schedules, including disbursements and repayment plans.
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/cases/${caseId}/payment-schedule`)}
                  className="w-full"
                >
                  Open Payment Schedule →
                </Button>
              </Card.Content>
            </Card>
          )}

          {/* Manzoori Upload Section - Show during Manzoori workflow stage */}
          {/* Hide if case has been approved (moved to next stage) */}
          {caseItem.current_workflow_stage_name === 'Manzoori' && 
           !caseItem.status_name?.includes('approved') && 
           caseItem.status_name !== 'finance_disbursement' && (
            <ManzooriUploadSection 
              caseId={caseId} 
              canEdit={caseItem.workflowPermissions?.can_edit || false}
              canView={caseItem.workflowPermissions?.can_view !== false}
            />
          )}

          {/* Comments Section */}
          <Card>
            <Card.Header>
              <h3 className="text-lg font-semibold text-gray-900">Comments & Feedback</h3>
            </Card.Header>
            <Card.Content>
              <CommentsSection caseId={caseId} />
            </Card.Content>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Applicant Information */}
          <Card>
            <Card.Header>
              <h3 className="text-lg font-semibold text-gray-900">Applicant</h3>
            </Card.Header>
            <Card.Content>
              <div className="space-y-4">
                {/* Name, Email, Phone on left, Photo on right */}
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Name
                      </label>
                      <p className="text-sm text-gray-900">
                        {caseItem.full_name || `${caseItem.first_name || ''} ${caseItem.last_name || ''}`.trim() || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Email
                      </label>
                      <p className="text-sm text-gray-900">
                        {caseItem.email || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Phone
                      </label>
                      <p className="text-sm text-gray-900">
                        {caseItem.phone || 'N/A'}
                      </p>
                    </div>
                  </div>
                  {/* Applicant Photo on the right */}
                  {caseItem.photo && (
                    <div className="flex-shrink-0">
                      <img
                        src={caseItem.photo}
                        alt={caseItem.full_name || `${caseItem.first_name} ${caseItem.last_name}`}
                        className="w-32 h-40 rounded object-cover border-2 border-gray-200"
                      />
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/applicants/${caseItem.applicant_id}`)}
                  className="w-full"
                >
                  View Applicant Details
                </Button>
              </div>
            </Card.Content>
          </Card>

          {/* Counselor Information - Show when counselor is assigned */}
          {caseItem.assigned_counselor_id && caseItem.counselor_full_name && (
            <Card>
              <Card.Header>
                <h3 className="text-lg font-semibold text-gray-900">Counselor</h3>
              </Card.Header>
              <Card.Content>
                <div className="space-y-4">
                  {/* Name, Email, Phone on left, Photo on right */}
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Name
                        </label>
                        <p className="text-sm text-gray-900">
                          {caseItem.counselor_full_name}
                        </p>
                      </div>
                      {caseItem.counselor_email && (
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">
                            Email
                          </label>
                          <p className="text-sm text-gray-900">
                            {caseItem.counselor_email}
                          </p>
                        </div>
                      )}
                      {caseItem.counselor_phone && (
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">
                            Mobile Number
                          </label>
                          <p className="text-sm text-gray-900">
                            {caseItem.counselor_phone}
                          </p>
                        </div>
                      )}
                    </div>
                    {/* Counselor Photo on the right */}
                    {caseItem.counselor_photo && (
                      <div className="flex-shrink-0">
                        <img
                          src={caseItem.counselor_photo}
                          alt={caseItem.counselor_full_name}
                          className="w-32 h-40 rounded object-cover border-2 border-gray-200"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Card.Content>
            </Card>
          )}

          {/* Case Timeline */}
          <Card>
            <Card.Header>
              <h3 className="text-lg font-semibold text-gray-900">Timeline</h3>
            </Card.Header>
            <Card.Content>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary-600 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Case Created</p>
                    <p className="text-xs text-gray-500">{formatDate(caseItem.created_at)}</p>
                  </div>
                </div>
                {caseItem.assigned_at && (
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Case Assigned</p>
                      <p className="text-xs text-gray-500">{formatDate(caseItem.assigned_at)}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-600 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Last Updated</p>
                    <p className="text-xs text-gray-500">{formatDate(caseItem.updated_at)}</p>
                  </div>
                </div>
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>

      {/* Assign Case / Reassign Modal - Role + Assign To only (same as list page) */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setAssignModalMode('assign');
          setSelectedRoleId('');
          setSelectedCounselorId('');
        }}
        title={assignModalMode === 'reassign' ? 'Reassign' : 'Assign Case'}
        size="xl"
      >
        <div className="space-y-4 min-h-[32rem]">
          <Select
            label="Role"
            value={selectedRoleId}
            onChange={(e) => {
              setSelectedRoleId(e.target.value);
              setSelectedCounselorId('');
            }}
            required
          >
            <Select.Option value="">Select Role</Select.Option>
            {rolesData?.map((role) => (
              <Select.Option key={role.id} value={role.name}>
                {role.name}
              </Select.Option>
            ))}
          </Select>

          <SearchableSelect
            label="Assign To"
            value={selectedCounselorId}
            onChange={(val) => setSelectedCounselorId(val)}
            placeholder={selectedRoleId ? 'Search or select user...' : 'Select Role first'}
            required
            disabled={!selectedRoleId}
            options={[
              { value: '', label: selectedRoleId ? 'Select user' : 'Select Role first' },
              ...(usersData || [])
                .map((user) => ({
                  value: user.id,
                  label: user.its_number
                    ? `${user.full_name || user.username} (${user.its_number})`
                    : `${user.full_name || user.username}${user.email ? ` (${user.email})` : ''}`
                }))
                .sort((a, b) => (a.label || '').toLowerCase().localeCompare((b.label || '').toLowerCase()))
            ]}
          />

          <Alert severity="info">
            {assignModalMode === 'reassign'
              ? 'Select a new assignee. The case status will remain "Assigned".'
              : 'Assigning a user will automatically change the case status to "Assigned" when both role and user are selected.'}
          </Alert>
        </div>

        <Modal.Footer>
          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={() => {
                setAssignModalOpen(false);
                setAssignModalMode('assign');
                setSelectedRoleId('');
                setSelectedCounselorId('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignCase}
              loading={assignCaseMutation.isLoading}
              disabled={!selectedRoleId || !selectedCounselorId || assignCaseMutation.isLoading}
            >
              {assignModalMode === 'reassign' ? 'Reassign' : 'Assign Case'}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Assign / Reassign Counselor Modal - same layout as Assign/Reassign (field then info then footer) */}
      <Modal
        isOpen={counselorAssignModalOpen}
        onClose={() => {
          setCounselorAssignModalOpen(false);
          setSelectedCounselorIdForAssignment('');
        }}
        title={counselorModalMode === 'reassign' ? 'Reassign Counselor' : 'Assign Counselor'}
        size="xl"
      >
        <div className="space-y-4 min-h-[32rem]">
          <SearchableSelect
            label="Select Counselor"
            value={selectedCounselorIdForAssignment}
            onChange={(val) => setSelectedCounselorIdForAssignment(val)}
            placeholder="Unassigned"
            required
            options={[
              { value: 'unassign', label: 'Unassign Counselor' },
              ...(availableCounselorsData || [])
                .map((c) => ({
                  value: c.id,
                  label: c.its_number
                    ? `${c.full_name || c.username} - (${c.its_number})`
                    : (c.full_name || c.username) + (c.email ? ` (${c.email})` : '')
                }))
                .sort((a, b) => (a.label || '').toLowerCase().localeCompare((b.label || '').toLowerCase()))
            ]}
          />

          <Alert severity="info">
            Select a counselor from the available list. Counselors are filtered by the case's location (Jamiat/Jamaat).
          </Alert>

          {availableCounselorsData && availableCounselorsData.length === 0 && (
            <Alert severity="warning">
              No counselors available for this case. Make sure counselors are assigned to the Counselor workflow stage.
            </Alert>
          )}
        </div>

        <Modal.Footer>
          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={() => {
                setCounselorAssignModalOpen(false);
                setSelectedCounselorIdForAssignment('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignCounselor}
              loading={assignCounselorMutation.isLoading}
              disabled={!selectedCounselorIdForAssignment || assignCounselorMutation.isLoading}
            >
              {selectedCounselorIdForAssignment === 'unassign' ? 'Unassign' : counselorModalMode === 'reassign' ? 'Reassign Counselor' : 'Assign Counselor'}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CaseDetails;