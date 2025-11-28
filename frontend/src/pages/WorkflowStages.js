import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Button, 
  Input, 
  Card, 
  Modal, 
  Alert,
  Chip,
  Badge,
  Switch,
  Select,
  MultiSelect
} from '../components/ui';

// Icon components
const AddIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const DeleteIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const DragHandleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

// Sortable Stage Item Component
const SortableStageItem = ({ stage, onEdit, onDelete, onRestore, onManageRoles, onManageUsers }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isDeleted = !stage.is_active;
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg p-4 mb-3 shadow-sm hover:shadow-md transition-shadow ${
        isDeleted 
          ? 'bg-gray-50 border-gray-300 opacity-60' 
          : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab hover:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
          >
            <DragHandleIcon />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${isDeleted ? 'text-gray-500' : 'text-gray-900'}`}>
              {stage.stage_name}
              {isDeleted && <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Deleted</span>}
            </h3>
            <p className={`text-sm ${isDeleted ? 'text-gray-400' : 'text-gray-600'}`}>{stage.description}</p>
            {stage.sla_value && stage.sla_unit && (
              <p className={`text-xs mt-1 ${isDeleted ? 'text-gray-400' : 'text-blue-600'}`}>
                SLA: {stage.sla_value} {stage.sla_unit}
                {stage.sla_warning_value && stage.sla_warning_unit && (
                  <span> (Warning: {stage.sla_warning_value} {stage.sla_warning_unit})</span>
                )}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="flex items-center space-x-1">
              <ShieldIcon />
              <span>{stage.role_count || 0} Roles</span>
            </Badge>
            <Badge variant="secondary" className="flex items-center space-x-1">
              <UsersIcon />
              <span>{stage.user_count || 0} Users</span>
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            {!isDeleted ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onManageRoles(stage)}
                  className="flex items-center space-x-1"
                >
                  <ShieldIcon />
                  <span>Roles</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onManageUsers(stage)}
                  className="flex items-center space-x-1"
                >
                  <UsersIcon />
                  <span>Users</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(stage)}
                  className="flex items-center space-x-1"
                >
                  <EditIcon />
                  <span>Edit</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(stage.id)}
                  className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                >
                  <DeleteIcon />
                  <span>Delete</span>
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRestore(stage.id)}
                className="flex items-center space-x-1 text-green-600 hover:text-green-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Restore</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const WorkflowStages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState('');
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');
  const [activeCaseType, setActiveCaseType] = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [expandedRoleId, setExpandedRoleId] = useState(null); // Track which role permissions are being edited
  const [rolePermissions, setRolePermissions] = useState({}); // Store permission changes

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch workflow stages grouped by case type
  const { data: workflowData, isLoading, error: fetchError } = useQuery(
    ['workflowStagesByCaseType', showDeleted],
    () => {
      const url = `/api/workflow-stages/by-case-type${showDeleted ? '?include_deleted=true' : ''}`;
      console.log('Fetching workflow data with URL:', url, 'showDeleted:', showDeleted);
      return axios.get(url).then(res => {
        console.log('Workflow data received:', res.data);
        return res.data;
      });
    },
    {
      enabled: user?.role === 'admin' || user?.role === 'super_admin',
      retry: false,
    }
  );

  // Fetch case types for tabs
  const { data: caseTypesData, isLoading: caseTypesLoading } = useQuery(
    'caseTypes',
    () => axios.get('/api/case-types').then(res => res.data),
    {
      enabled: user?.role === 'admin' || user?.role === 'super_admin',
      retry: false,
    }
  );

  // Fetch available roles
  const { data: rolesData, error: rolesError, isLoading: rolesLoading } = useQuery(
    'availableRoles',
    () => axios.get('/api/workflow-stages/available/roles').then(res => {
      console.log('Available roles API response:', res.data);
      return res.data;
    }),
    {
      enabled: user?.role === 'admin' || user?.role === 'super_admin',
      retry: false,
    }
  );

  // Fetch available users
  const { data: usersData, error: usersError, isLoading: usersLoading } = useQuery(
    'availableUsers',
    () => axios.get('/api/workflow-stages/available/users').then(res => {
      console.log('Available users API response:', res.data);
      return res.data;
    }),
    {
      enabled: user?.role === 'admin' || user?.role === 'super_admin',
      retry: false,
    }
  );

  // Create stage mutation
  const createMutation = useMutation(
    (stageData) => axios.post('/api/workflow-stages', stageData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflowStagesByCaseType');
        setSuccess('Workflow stage created successfully!');
        setError('');
        setModalOpen(false);
        reset();
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to create workflow stage');
        setSuccess('');
      },
    }
  );

  // Update stage mutation
  const updateMutation = useMutation(
    ({ id, data }) => axios.put(`/api/workflow-stages/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflowStagesByCaseType');
        setSuccess('Workflow stage updated successfully!');
        setError('');
        setModalOpen(false);
        setEditingStage(null);
        reset();
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to update workflow stage');
        setSuccess('');
      },
    }
  );

  // Delete stage mutation
  const deleteMutation = useMutation(
    (id) => axios.delete(`/api/workflow-stages/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflowStagesByCaseType');
        setSuccess('Workflow stage deleted successfully!');
        setError('');
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to delete workflow stage');
        setSuccess('');
      },
    }
  );

  // Reorder stages mutation
  const reorderMutation = useMutation(
    (stages) => axios.put('/api/workflow-stages/reorder', { stages }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflowStagesByCaseType');
        setSuccess('Workflow stages reordered successfully!');
        setError('');
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to reorder workflow stages');
        setSuccess('');
      },
    }
  );

  // Add role to stage mutation
  const addRoleMutation = useMutation(
    ({ stageId, roleId, permissions }) => axios.post(`/api/workflow-stages/${stageId}/roles`, {
      role_id: roleId,
      can_approve: permissions.can_approve || false,
      can_reject: permissions.can_reject || false,
      can_review: permissions.can_review || false,
      can_view: permissions.can_view !== false,
      can_edit: permissions.can_edit || false,
      can_delete: permissions.can_delete || false,
      can_create_case: permissions.can_create_case || false,
      can_fill_case: permissions.can_fill_case || false
    }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflowStagesByCaseType');
        setSuccess('Role added to stage successfully');
        setError('');
        setSelectedRoleToAdd('');
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to add role to stage');
        setSuccess('');
      }
    }
  );

  // Remove role from stage mutation
  const removeRoleMutation = useMutation(
    ({ stageId, roleId }) => axios.delete(`/api/workflow-stages/${stageId}/roles/${roleId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflowStagesByCaseType');
        setSuccess('Role removed from stage successfully');
        setError('');
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to remove role from stage');
        setSuccess('');
      }
    }
  );

  // Update role permissions mutation
  const updateRolePermissionsMutation = useMutation(
    ({ stageId, roleId, permissions }) => axios.put(`/api/workflow-stages/${stageId}/roles/${roleId}`, permissions),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflowStagesByCaseType');
        setSuccess('Role permissions updated successfully');
        setError('');
        setExpandedRoleId(null);
        setRolePermissions({});
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to update role permissions');
        setSuccess('');
      }
    }
  );


  // Add user to stage mutation
  const addUserMutation = useMutation(
    ({ stageId, userId, permissions }) => axios.post(`/api/workflow-stages/${stageId}/users`, {
      user_id: userId,
      can_approve: permissions.can_approve,
      can_review: permissions.can_review,
      can_view: permissions.can_view,
      can_create_case: permissions.can_create_case,
      can_fill_case: permissions.can_fill_case
    }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflowStagesByCaseType');
        setSuccess('User added to stage successfully');
        setError('');
        setSelectedUserToAdd('');
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to add user to stage');
        setSuccess('');
      }
    }
  );

  // Remove user from stage mutation
  const removeUserMutation = useMutation(
    ({ stageId, userId }) => axios.delete(`/api/workflow-stages/${stageId}/users/${userId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflowStagesByCaseType');
        setSuccess('User removed from stage successfully');
        setError('');
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to remove user from stage');
        setSuccess('');
      }
    }
  );

  // Restore stage mutation
  const restoreMutation = useMutation(
    (id) => axios.put(`/api/workflow-stages/${id}/restore`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('workflowStagesByCaseType');
        setSuccess('Workflow stage restored successfully!');
        setError('');
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to restore workflow stage');
        setSuccess('');
      },
    }
  );


  const onSubmit = async (data) => {
    setError('');
    setSuccess('');

    if (editingStage) {
      updateMutation.mutate({ id: editingStage.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (stage) => {
    setEditingStage(stage);
    setValue('stage_name', stage.stage_name);
    setValue('stage_key', stage.stage_key);
    setValue('description', stage.description || '');
    setValue('sort_order', stage.sort_order || 0);
    setValue('case_type_id', stage.case_type_id || '');
    setValue('sla_value', stage.sla_value || '');
    setValue('sla_unit', stage.sla_unit || '');
    setValue('sla_warning_value', stage.sla_warning_value || '');
    setValue('sla_warning_unit', stage.sla_warning_unit || '');
    setModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this workflow stage?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleRestore = (id) => {
    if (window.confirm('Are you sure you want to restore this workflow stage?')) {
      restoreMutation.mutate(id);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingStage(null);
    setError('');
    setSuccess('');
    reset();
  };

  const handleManageRoles = (stage) => {
    setSelectedStage(stage);
    setRolesModalOpen(true);
  };

  const handleManageUsers = (stage) => {
    setSelectedStage(stage);
    setUsersModalOpen(true);
  };

  const handleAddRole = () => {
    if (!selectedRoleToAdd) {
      setError('Please select a role to add');
      return;
    }

    // Default permissions for new roles - user can edit after adding
    const permissions = {
      can_approve: false,
      can_reject: false,
      can_review: false,
      can_view: true,
      can_edit: false,
      can_delete: false,
      can_create_case: false,
      can_fill_case: false
    };

    addRoleMutation.mutate({
      stageId: selectedStage.id,
      roleId: selectedRoleToAdd,
      permissions
    }, {
      onSuccess: () => {
        setSelectedRoleToAdd('');
      }
    });
  };

  const handleRemoveRole = (roleId) => {
    console.log('Removing role:', roleId, 'from stage:', selectedStage.id);
    console.log('selectedStage:', selectedStage);
    removeRoleMutation.mutate({
      stageId: selectedStage.id,
      roleId
    });
  };


  const handleAddUser = () => {
    if (!selectedUserToAdd) {
      setError('Please select a user to add');
      return;
    }

    // Default permissions for new users (create/fill case permissions managed at role level)
    const permissions = {
      can_approve: true,
      can_review: true,
      can_view: true,
      can_create_case: false,
      can_fill_case: false
    };

    addUserMutation.mutate({
      stageId: selectedStage.id,
      userId: selectedUserToAdd,
      permissions
    });
  };

  const handleRemoveUser = (userId) => {
    removeUserMutation.mutate({
      stageId: selectedStage.id,
      userId
    });
  };


  const handleRefresh = () => {
    queryClient.invalidateQueries('workflowStagesByCaseType');
    queryClient.invalidateQueries('caseTypes');
    queryClient.invalidateQueries('availableRoles');
    queryClient.invalidateQueries('availableUsers');
    setSuccess('Data refreshed successfully');
    setTimeout(() => setSuccess(''), 3000);
  };

  // Set default active case type when data loads
  useEffect(() => {
    if (caseTypesData?.caseTypes?.length > 0 && !activeCaseType) {
      setActiveCaseType(caseTypesData.caseTypes[0].id);
    }
  }, [caseTypesData, activeCaseType]);

  // Update selectedStage when workflow data changes
  useEffect(() => {
    if (selectedStage && workflowData?.workflowByCaseType) {
      const activeWorkflow = workflowData.workflowByCaseType[activeCaseType];
      if (activeWorkflow?.stages?.length > 0) {
        const updatedStage = activeWorkflow.stages.find(s => s.id === selectedStage.id);
        if (updatedStage) {
          setSelectedStage(updatedStage);
        }
      }
    }
  }, [workflowData, selectedStage, activeCaseType]);

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const activeWorkflow = workflowData?.workflowByCaseType?.[activeCaseType];
      const stages = activeWorkflow?.stages || [];
      const oldIndex = stages.findIndex((stage) => stage.id === active.id);
      const newIndex = stages.findIndex((stage) => stage.id === over.id);

      const reorderedStages = arrayMove(stages, oldIndex, newIndex);
      reorderMutation.mutate(reorderedStages);
    }
  };

  if (fetchError) {
    return (
      <div className="p-6">
        <Alert severity="error">
          Error loading workflow stages: {fetchError.message}
        </Alert>
      </div>
    );
  }

  const caseTypes = caseTypesData?.caseTypes || [];
  const activeWorkflow = workflowData?.workflowByCaseType?.[activeCaseType];
  const stages = activeWorkflow?.stages || [];
  const availableRoles = rolesData?.roles || [];
  const availableUsers = usersData?.users || [];

  // Debug logging
  console.log('Frontend Debug - showDeleted:', showDeleted);
  console.log('Frontend Debug - activeCaseType:', activeCaseType);
  console.log('Frontend Debug - workflowData:', workflowData);
  console.log('Frontend Debug - activeWorkflow:', activeWorkflow);
  console.log('Frontend Debug - stages:', stages);

  // Debug logging
  console.log('rolesData:', rolesData);
  console.log('rolesError:', rolesError);
  console.log('rolesLoading:', rolesLoading);
  console.log('availableRoles:', availableRoles);
  console.log('usersData:', usersData);
  console.log('usersError:', usersError);
  console.log('usersLoading:', usersLoading);
  console.log('availableUsers:', availableUsers);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Workflow Stages</h1>
            <p className="text-gray-600">Configure case approval workflow stages and permissions</p>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </Button>
            <Button
              onClick={() => setShowDeleted(!showDeleted)}
              variant="outline"
              className={`flex items-center space-x-2 ${showDeleted ? 'bg-gray-100' : ''}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>{showDeleted ? 'Hide Deleted' : 'Show Deleted'}</span>
            </Button>
            <Button
              onClick={() => setModalOpen(true)}
              className="flex items-center space-x-2"
            >
              <AddIcon />
              <span>Add Stage</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Alert severity="success" className="mb-4">
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" className="mb-4">
          {error}
        </Alert>
      )}
      {rolesError && (
        <Alert severity="error" className="mb-4">
          Failed to load available roles: {rolesError.message}
        </Alert>
      )}
      {usersError && (
        <Alert severity="error" className="mb-4">
          Failed to load available users: {usersError.message}
        </Alert>
      )}

      {/* Case Type Tabs */}
      {caseTypes.length > 0 && (
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {caseTypes.map((caseType) => (
                <button
                  key={caseType.id}
                  onClick={() => setActiveCaseType(caseType.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeCaseType === caseType.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {caseType.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Workflow Stages List */}
      <Card>
        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Workflow Stages ({stages.length})
                </h3>
                <p className="text-sm text-gray-600">
                  Drag and drop to reorder stages. Click on Roles/Users to manage permissions.
                </p>
              </div>
              
              {stages.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={stages.map(stage => stage.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {stages.map((stage) => (
                      <SortableStageItem
                        key={stage.id}
                        stage={stage}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onRestore={handleRestore}
                        onManageRoles={handleManageRoles}
                        onManageUsers={handleManageUsers}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No workflow stages found</h3>
                  <p className="text-gray-600 mb-4">
                    Get started by creating your first workflow stage.
                  </p>
                  <Button onClick={() => setModalOpen(true)}>
                    Add Workflow Stage
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Create/Edit Stage Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleModalClose}
        title={editingStage ? 'Edit Workflow Stage' : 'Add New Workflow Stage'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Stage Name"
              required
              error={errors.stage_name?.message}
              {...register('stage_name', { 
                required: 'Stage name is required' 
              })}
              placeholder="Enter stage name"
            />

            <Input
              label="Stage Key"
              required
              error={errors.stage_key?.message}
              {...register('stage_key', { 
                required: 'Stage key is required',
                pattern: {
                  value: /^[a-z_]+$/,
                  message: 'Stage key must contain only lowercase letters and underscores'
                }
              })}
              placeholder="e.g., draft_stage"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter stage description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Case Type
              </label>
              <select
                {...register('case_type_id', { 
                  valueAsNumber: true 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                defaultValue={activeCaseType || ''}
              >
                <option value="">Select a case type</option>
                {caseTypes.map((caseType) => (
                  <option key={caseType.id} value={caseType.id}>
                    {caseType.name}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Sort Order"
              type="number"
              error={errors.sort_order?.message}
              {...register('sort_order', { 
                valueAsNumber: true,
                min: { value: 0, message: 'Sort order must be 0 or greater' }
              })}
              placeholder="0"
            />
          </div>

          {/* SLA Configuration Section */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">SLA Configuration (Optional)</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="SLA Value"
                  type="number"
                  step="0.01"
                  error={errors.sla_value?.message}
                  {...register('sla_value', { 
                    valueAsNumber: true,
                    min: { value: 0.01, message: 'SLA value must be greater than 0' }
                  })}
                  placeholder="e.g., 2"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SLA Unit
                  </label>
                  <select
                    {...register('sla_unit')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Select unit</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="business_days">Business Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Warning Value (Optional)"
                  type="number"
                  step="0.01"
                  error={errors.sla_warning_value?.message}
                  {...register('sla_warning_value', { 
                    valueAsNumber: true,
                    min: { value: 0.01, message: 'Warning value must be greater than 0' }
                  })}
                  placeholder="e.g., 1"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Warning Unit (Optional)
                  </label>
                  <select
                    {...register('sla_warning_unit')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Select unit</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="business_days">Business Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Set a time limit for cases in this stage. If warning value is set, a warning notification will be sent when the warning time is reached.
              </p>
            </div>
          </div>


          <Modal.Footer>
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleModalClose}
                disabled={createMutation.isLoading || updateMutation.isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createMutation.isLoading || updateMutation.isLoading}
                disabled={createMutation.isLoading || updateMutation.isLoading}
              >
                {editingStage ? 'Update' : 'Create'} Stage
              </Button>
            </div>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Roles Management Modal */}
      <Modal
        isOpen={rolesModalOpen}
        onClose={() => setRolesModalOpen(false)}
        title={`Manage Roles - ${selectedStage?.stage_name}`}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Assign roles to this workflow stage and set their permissions.
          </p>
          
          {/* Current Roles */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Current Roles</h4>
            <div className="space-y-2">
              {selectedStage?.roles?.map((role) => (
                 <div key={role.id} className="border border-gray-200 rounded-lg overflow-hidden">
                   <div className="flex items-center justify-between p-3 bg-gray-50">
                     <div className="flex-1">
                       <div className="font-medium text-gray-900">{role.display_name || role.name}</div>
                       {expandedRoleId === role.id ? null : (
                         <div className="text-xs text-gray-500 mt-1">
                           Permissions: {[
                             role.can_approve && 'Approve',
                             role.can_reject !== undefined ? (role.can_reject && 'Reject') : null,
                             role.can_review && 'Review',
                             role.can_view && 'View'
                           ].filter(Boolean).join(', ') || 'None'}
                         </div>
                       )}
                     </div>
                     <div className="flex gap-2">
                       {expandedRoleId === role.id ? (
                         <>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => {
                               const permissions = rolePermissions[role.id] || {
                                 can_approve: role.can_approve || false,
                                 can_reject: role.can_reject !== undefined ? role.can_reject : false,
                                 can_review: role.can_review || false,
                                 can_view: role.can_view !== false,
                                 can_edit: role.can_edit || false,
                                 can_delete: role.can_delete || false,
                                 can_create_case: role.can_create_case || false,
                                 can_fill_case: role.can_fill_case || false
                               };
                               updateRolePermissionsMutation.mutate({
                                 stageId: selectedStage.id,
                                 roleId: role.id,
                                 permissions
                               });
                             }}
                             disabled={updateRolePermissionsMutation.isLoading}
                             className="text-blue-600 hover:text-blue-700"
                           >
                             {updateRolePermissionsMutation.isLoading ? 'Saving...' : 'Save'}
                           </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => {
                               setExpandedRoleId(null);
                               setRolePermissions({});
                             }}
                             disabled={updateRolePermissionsMutation.isLoading}
                           >
                             Cancel
                           </Button>
                         </>
                       ) : (
                         <>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => {
                               setExpandedRoleId(role.id);
                               setRolePermissions({
                                 ...rolePermissions,
                                 [role.id]: {
                                   can_approve: role.can_approve || false,
                                   can_reject: role.can_reject !== undefined ? role.can_reject : false,
                                   can_review: role.can_review || false,
                                   can_view: role.can_view !== false,
                                   can_edit: role.can_edit || false,
                                   can_delete: role.can_delete || false,
                                   can_create_case: role.can_create_case || false,
                                   can_fill_case: role.can_fill_case || false
                                 }
                               });
                             }}
                             className="text-blue-600 hover:text-blue-700"
                           >
                             Edit Permissions
                           </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => handleRemoveRole(role.id)}
                             className="text-red-600 hover:text-red-700"
                             disabled={removeRoleMutation.isLoading}
                           >
                             {removeRoleMutation.isLoading ? 'Removing...' : 'Remove'}
                           </Button>
                         </>
                       )}
                     </div>
                   </div>
                   {expandedRoleId === role.id && (
                     <div className="p-4 bg-white border-t border-gray-200">
                       <div className="space-y-3">
                         <div className="text-sm font-medium text-gray-700 mb-3">Permission Settings:</div>
                         <div className="grid grid-cols-2 gap-3">
                           <label className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               checked={rolePermissions[role.id]?.can_approve || false}
                               onChange={(e) => setRolePermissions({
                                 ...rolePermissions,
                                 [role.id]: {
                                   ...rolePermissions[role.id],
                                   can_approve: e.target.checked
                                 }
                               })}
                               className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                             />
                             <span className="text-sm text-gray-700">Can Approve</span>
                           </label>
                           <label className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               checked={rolePermissions[role.id]?.can_reject !== undefined ? rolePermissions[role.id].can_reject : false}
                               onChange={(e) => setRolePermissions({
                                 ...rolePermissions,
                                 [role.id]: {
                                   ...rolePermissions[role.id],
                                   can_reject: e.target.checked
                                 }
                               })}
                               className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                             />
                             <span className="text-sm text-gray-700">Can Reject</span>
                           </label>
                           <label className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               checked={rolePermissions[role.id]?.can_review || false}
                               onChange={(e) => setRolePermissions({
                                 ...rolePermissions,
                                 [role.id]: {
                                   ...rolePermissions[role.id],
                                   can_review: e.target.checked
                                 }
                               })}
                               className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                             />
                             <span className="text-sm text-gray-700">Can Review</span>
                           </label>
                           <label className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               checked={rolePermissions[role.id]?.can_view !== false}
                               onChange={(e) => setRolePermissions({
                                 ...rolePermissions,
                                 [role.id]: {
                                   ...rolePermissions[role.id],
                                   can_view: e.target.checked
                                 }
                               })}
                               className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                             />
                             <span className="text-sm text-gray-700">Can View</span>
                           </label>
                           <label className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               checked={rolePermissions[role.id]?.can_edit || false}
                               onChange={(e) => setRolePermissions({
                                 ...rolePermissions,
                                 [role.id]: {
                                   ...rolePermissions[role.id],
                                   can_edit: e.target.checked
                                 }
                               })}
                               className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                             />
                             <span className="text-sm text-gray-700">Can Edit</span>
                           </label>
                           <label className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               checked={rolePermissions[role.id]?.can_delete || false}
                               onChange={(e) => setRolePermissions({
                                 ...rolePermissions,
                                 [role.id]: {
                                   ...rolePermissions[role.id],
                                   can_delete: e.target.checked
                                 }
                               })}
                               className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                             />
                             <span className="text-sm text-gray-700">Can Delete</span>
                           </label>
                         </div>
                         <div className="mt-2 text-xs text-gray-500">
                           💡 <strong>Important:</strong> Enable "Can Approve" and "Can Reject" for workflow buttons to appear
                         </div>
                       </div>
                     </div>
                   )}
                 </div>
              ))}
            </div>
          </div>

          {/* Add New Role */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Add Role</h4>
            <div className="space-y-3">
              <select
                value={selectedRoleToAdd}
                onChange={(e) => setSelectedRoleToAdd(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">Select a role to add</option>
                {(() => {
                  console.log('selectedStage:', selectedStage);
                  console.log('selectedStage.roles:', selectedStage?.roles);
                  console.log('availableRoles before filter:', availableRoles);
                  
                  // Ensure selectedStage.roles is an array
                  const currentRoles = selectedStage?.roles || [];
                  
                  const filteredRoles = availableRoles.filter(role => {
                    const isAlreadyAssigned = currentRoles.some(stageRole => stageRole.id === role.id);
                    console.log(`Role ${role.name} (ID: ${role.id}) - already assigned:`, isAlreadyAssigned);
                    return !isAlreadyAssigned;
                  });
                  
                  console.log('filteredRoles:', filteredRoles);
                  
                  return filteredRoles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.display_name || role.name}
                    </option>
                  ));
                })()}
               </select>
               <Button
                onClick={handleAddRole}
                disabled={!selectedRoleToAdd || addRoleMutation.isLoading}
                className="w-full"
              >
                {addRoleMutation.isLoading ? 'Adding...' : 'Add Role'}
              </Button>
            </div>
          </div>
        </div>

        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setRolesModalOpen(false);
              setSelectedRoleToAdd('');
              setExpandedRoleId(null);
              setRolePermissions({});
            }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Users Management Modal */}
      <Modal
        isOpen={usersModalOpen}
        onClose={() => setUsersModalOpen(false)}
        title={`Manage Users - ${selectedStage?.stage_name}`}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Assign specific users to this workflow stage and set their permissions.
          </p>
          
          {/* Current Users */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Current Users</h4>
            <div className="space-y-2">
              {(() => {
                console.log('selectedStage in users modal:', selectedStage);
                console.log('selectedStage.users:', selectedStage?.users);
                console.log('selectedStage.users length:', selectedStage?.users?.length);
                return null;
              })()}
               {selectedStage?.users?.map((user) => (
                 <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                   <div>
                     <div className="font-medium text-gray-900">{user.full_name}</div>
                     <div className="text-sm text-gray-600">{user.email} • {user.role}</div>
                   </div>
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => handleRemoveUser(user.id)}
                     className="text-red-600 hover:text-red-700"
                     disabled={removeUserMutation.isLoading}
                   >
                     {removeUserMutation.isLoading ? 'Removing...' : 'Remove'}
                   </Button>
                 </div>
               ))}
            </div>
          </div>

          {/* Add New User */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Add User</h4>
            <div className="space-y-3">
              <select
                value={selectedUserToAdd}
                onChange={(e) => setSelectedUserToAdd(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">Select a user to add</option>
                {(() => {
                  console.log('selectedStage:', selectedStage);
                  console.log('selectedStage.users:', selectedStage?.users);
                  console.log('availableUsers before filter:', availableUsers);
                  
                  // Ensure selectedStage.users is an array
                  const currentUsers = selectedStage?.users || [];
                  
                  const filteredUsers = availableUsers.filter(user => {
                    const isAlreadyAssigned = currentUsers.some(stageUser => stageUser.id === user.id);
                    console.log(`User ${user.full_name} (ID: ${user.id}) - already assigned:`, isAlreadyAssigned);
                    
                    // Filter by role - show only users with roles that match the stage's assigned roles
                    const stageRoles = selectedStage?.roles || [];
                    const hasMatchingRole = stageRoles.some(role => role.name === user.role);
                    console.log(`User ${user.full_name} has matching role:`, hasMatchingRole);
                    
                    // If no roles are assigned to the stage, show all users
                    // If roles are assigned, show only users with matching roles
                    if (stageRoles.length === 0) {
                      return !isAlreadyAssigned;
                    } else {
                      return !isAlreadyAssigned && hasMatchingRole;
                    }
                  });
                  
                  console.log('filteredUsers:', filteredUsers);
                  
                  return filteredUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </option>
                  ));
                })()}
               </select>
               <Button
                onClick={handleAddUser}
                disabled={!selectedUserToAdd || addUserMutation.isLoading}
                className="w-full"
              >
                {addUserMutation.isLoading ? 'Adding...' : 'Add User'}
              </Button>
            </div>
          </div>
        </div>

        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setUsersModalOpen(false);
              setSelectedUserToAdd('');
            }}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default WorkflowStages;
