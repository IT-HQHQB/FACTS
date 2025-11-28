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
  Input
} from '../components/ui';
import WelfareChecklistForm from '../components/WelfareChecklistForm';

// Icon components
const ArrowLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

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
  
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedCounselorId, setSelectedCounselorId] = useState('');
  // Counselor assignment modal state
  const [counselorAssignModalOpen, setCounselorAssignModalOpen] = useState(false);
  const [selectedCounselorIdForAssignment, setSelectedCounselorIdForAssignment] = useState('');
  const [counselorSearchTerm, setCounselorSearchTerm] = useState('');

  const { data: caseData, isLoading, error } = useQuery(
    ['case', caseId],
    () => axios.get(`/api/cases/${caseId}`).then(res => res.data),
    {
      enabled: !!caseId,
      refetchOnMount: true,
    }
  );

  // Fetch users for assignment
  const { data: usersData } = useQuery(
    ['users', selectedRoleId],
    () => {
      const params = {};
      if (selectedRoleId) params.role = selectedRoleId;
      params.is_active = 'true'; // Only fetch active users for assignment
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
    ({ caseId, assigned_roles, assigned_counselor_id }) =>
      axios.put(`/api/cases/${caseId}`, { assigned_roles, assigned_counselor_id }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['case', caseId]);
        setAssignModalOpen(false);
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
        setCounselorSearchTerm('');
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
        assigned_roles: selectedRoleId,
        assigned_counselor_id: selectedCounselorId,
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
              onClick={() => navigate('/cases')}
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
                    {(canAssignCase || canAssignCounselor) && (
                      <>
                        {canAssignCase && isUnassigned && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setAssignModalOpen(true)}
                          >
                            Assign Case
                          </Button>
                        )}
                        {canAssignCounselor && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCounselorAssignModalOpen(true);
                              setSelectedCounselorIdForAssignment(caseItem.assigned_counselor_id || '');
                              setCounselorSearchTerm('');
                            }}
                          >
                            {caseItem.counselor_full_name ? 'Change Counselor' : 'Assign Counselor'}
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

          {/* Payment Schedule Action Button - Show during finance disbursement stage */}
          {caseItem.status_name === 'finance_disbursement' && (
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

      {/* Assign Case Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setSelectedRoleId('');
          setSelectedCounselorId('');
        }}
        title="Assign Case"
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Role (DCM)"
            value={selectedRoleId}
            onChange={(e) => {
              setSelectedRoleId(e.target.value);
              setSelectedCounselorId(''); // Reset counselor when role changes
            }}
            required
          >
            <Select.Option value="">Select Role</Select.Option>
            {rolesData?.map((role) => (
              <Select.Option key={role.id} value={role.id}>
                {role.name}
              </Select.Option>
            ))}
          </Select>

          <Select
            label="Counselor"
            value={selectedCounselorId}
            onChange={(e) => setSelectedCounselorId(e.target.value)}
            required
            disabled={!selectedRoleId}
          >
            <Select.Option value="">{selectedRoleId ? 'Select Counselor' : 'Select Role first'}</Select.Option>
            {usersData?.map((user) => (
              <Select.Option key={user.id} value={user.id}>
                {user.full_name} ({user.email})
              </Select.Option>
            ))}
          </Select>

          <Alert severity="info">
            Assigning both role and counselor will automatically change the case status to "Assigned".
          </Alert>
        </div>

        <Modal.Footer>
          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={() => {
                setAssignModalOpen(false);
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
          setSelectedCounselorIdForAssignment('');
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
              value={selectedCounselorIdForAssignment}
              onChange={(e) => setSelectedCounselorIdForAssignment(e.target.value)}
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
              No counselors available for this case. Make sure counselors are assigned to the Counselor workflow stage.
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
                setSelectedCounselorIdForAssignment('');
                setCounselorSearchTerm('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignCounselor}
              loading={assignCounselorMutation.isLoading}
              disabled={!selectedCounselorIdForAssignment || assignCounselorMutation.isLoading}
            >
              {selectedCounselorIdForAssignment === 'unassign' ? 'Unassign' : 'Assign Counselor'}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CaseDetails;