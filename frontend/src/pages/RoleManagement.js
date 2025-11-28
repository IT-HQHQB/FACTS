import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { 
  Button, 
  Input, 
  Card, 
  Table, 
  Select, 
  Modal, 
  Badge,
  Switch,
  Tabs,
  Alert 
} from '../components/ui';

const RoleManagement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    permissions: {},
    counselingFormStages: {}
  });

  // Fetch roles
  const { data: rolesData, isLoading: rolesLoading } = useQuery(
    'roles',
    () => axios.get('/api/roles').then(res => res.data),
    {
      enabled: user?.role === 'super_admin',
      retry: false,
    }
  );

  const availableRoles = rolesData;

  // Fetch users
  const { data: usersData, isLoading: usersLoading } = useQuery(
    'users',
    () => axios.get('/api/users').then(res => res.data),
    {
      enabled: user?.role === 'super_admin',
      retry: false,
    }
  );

  const availableUsers = usersData;

  // Fetch available permissions
  const { data: permissionsData } = useQuery(
    'available-permissions',
    () => axios.get('/api/roles/permissions/available').then(res => res.data),
    {
      enabled: user?.role === 'super_admin',
      retry: false,
    }
  );

  const availablePermissions = permissionsData;

  // Create role mutation
  const createRoleMutation = useMutation(
    (roleData) => {
      // Convert permissions object to the format expected by the API
      const permissionsArray = [];
      if (roleData.permissions) {
        Object.entries(roleData.permissions).forEach(([resource, actions]) => {
          if (Array.isArray(actions)) {
            actions.forEach(action => {
              permissionsArray.push({
                permission: `${resource}.${action}`,
                resource: resource,
                action: action
              });
            });
          }
        });
      }

      // Convert stage permissions to array format
      const counselingFormStages = [];
      if (roleData.counselingFormStages && availablePermissions?.permissions) {
        const counselingFormsPerm = availablePermissions.permissions.find(p => p.resource === 'counseling_forms');
        if (counselingFormsPerm && counselingFormsPerm.stages) {
          counselingFormsPerm.stages.forEach(stage => {
            const stagePerm = roleData.counselingFormStages[stage.key] || {};
            counselingFormStages.push({
              stage_key: stage.key,
              stage_name: stage.name,
              can_read: stagePerm.can_read || false,
              can_update: stagePerm.can_update || false
            });
          });
        }
      }

      return axios.post('/api/roles', {
        name: roleData.name,
        display_name: roleData.name, // Use name as display_name for now
        description: roleData.description,
        permissions: permissionsArray,
        counseling_form_stages: counselingFormStages
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('roles');
        setCreateRoleModalOpen(false);
        setNewRole({ name: '', description: '', permissions: {}, counselingFormStages: {} });
      },
      onError: (error) => {
        console.error('Error creating role:', error);
        alert('Error creating role: ' + (error.response?.data?.error || error.message));
      }
    }
  );

  // Update role mutation
  const updateRoleMutation = useMutation(
    ({ roleId, roleData }) => {
      // Convert permissions object to the format expected by the API
      const permissionsArray = [];
      if (roleData.permissions) {
        Object.entries(roleData.permissions).forEach(([resource, actions]) => {
          if (Array.isArray(actions)) {
            actions.forEach(action => {
              permissionsArray.push({
                permission: `${resource}.${action}`,
                resource: resource,
                action: action
              });
            });
          }
        });
      }

      // Convert stage permissions to array format
      const counselingFormStages = [];
      if (roleData.counselingFormStages && availablePermissions?.permissions) {
        const counselingFormsPerm = availablePermissions.permissions.find(p => p.resource === 'counseling_forms');
        if (counselingFormsPerm && counselingFormsPerm.stages) {
          counselingFormsPerm.stages.forEach(stage => {
            const stagePerm = roleData.counselingFormStages[stage.key] || {};
            counselingFormStages.push({
              stage_key: stage.key,
              stage_name: stage.name,
              can_read: stagePerm.can_read || false,
              can_update: stagePerm.can_update || false
            });
          });
        }
      }

      return axios.put(`/api/roles/${roleId}`, {
        name: roleData.name,
        display_name: roleData.name, // Use name as display_name for now
        description: roleData.description,
        permissions: permissionsArray,
        counseling_form_stages: counselingFormStages
      });
    },
    {
      onSuccess: () => {
        // Invalidate and refetch the roles data to ensure fresh data
        queryClient.invalidateQueries('roles');
        setEditingRoleId(null);
        setNewRole({ name: '', description: '', permissions: {}, counselingFormStages: {} });
      },
      onError: (error) => {
        console.error('Error updating role:', error);
        alert('Error updating role: ' + (error.response?.data?.error || error.message));
      }
    }
  );

  // Delete role mutation
  const deleteRoleMutation = useMutation(
    (roleId) => axios.delete(`/api/roles/${roleId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('roles');
      },
      onError: (error) => {
        console.error('Error deleting role:', error);
        alert('Error deleting role: ' + (error.response?.data?.error || error.message));
      }
    }
  );

  // Assign role to user mutation
  const assignRoleMutation = useMutation(
    ({ userId, roleId }) => axios.post(`/api/roles/${roleId}/assign`, { user_id: userId }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
      },
      onError: (error) => {
        console.error('Error assigning role:', error);
        alert('Error assigning role: ' + (error.response?.data?.error || error.message));
      }
    }
  );

  const handleCreateRole = () => {
    createRoleMutation.mutate(newRole);
  };

  const handleEditRole = (role) => {
    setEditingRoleId(role.id);
    
    // Parse permissions - handle both object and JSON string formats
    let parsedPermissions = {};
    let stagePermissions = {};
    
    if (role.permissions) {
      if (typeof role.permissions === 'string') {
        try {
          const parsed = JSON.parse(role.permissions);
          // If it's an array of permission objects, convert to the expected format
          if (Array.isArray(parsed)) {
            parsed.forEach(perm => {
              if (!parsedPermissions[perm.resource]) {
                parsedPermissions[perm.resource] = [];
              }
              parsedPermissions[perm.resource].push(perm.action);
            });
          } else {
            // If it's already an object, use it directly
            parsedPermissions = parsed;
          }
        } catch (e) {
          parsedPermissions = {};
        }
      } else if (typeof role.permissions === 'object') {
        // If it's already an object, use it directly
        parsedPermissions = role.permissions;
        
        // Extract stage permissions if they exist
        if (role.permissions.counseling_forms_stages && Array.isArray(role.permissions.counseling_forms_stages)) {
          role.permissions.counseling_forms_stages.forEach(stage => {
            stagePermissions[stage.stage_key] = {
              can_read: stage.can_read || false,
              can_update: stage.can_update || false
            };
          });
        }
      }
    }
    
    setNewRole({
      name: role.name,
      description: role.description,
      permissions: parsedPermissions,
      counselingFormStages: stagePermissions
    });
  };

  const handleCancelEdit = () => {
    setEditingRoleId(null);
    setNewRole({ name: '', description: '', permissions: {}, counselingFormStages: {} });
  };

  const handleUpdateRole = () => {
    updateRoleMutation.mutate({
      roleId: editingRoleId,
      roleData: newRole
    });
  };

  const handleDeleteRole = (roleId) => {
    if (window.confirm('Are you sure you want to delete this role?')) {
      deleteRoleMutation.mutate(roleId);
    }
  };

  const handlePermissionChange = (resource, action, checked) => {
    setNewRole(prev => {
      const currentPermissions = prev.permissions || {};
      const currentResourcePermissions = currentPermissions[resource] || [];
      
      let newResourcePermissions;
      if (checked) {
        // Add permission if not already present
        newResourcePermissions = currentResourcePermissions.includes(action)
          ? currentResourcePermissions
          : [...currentResourcePermissions, action];
      } else {
        // Remove permission
        newResourcePermissions = currentResourcePermissions.filter(a => a !== action);
      }
      
      const newPermissions = {
        ...currentPermissions,
        [resource]: newResourcePermissions
      };
      
      return {
        ...prev,
        permissions: newPermissions
      };
    });
  };

  const handleStagePermissionChange = (stageKey, permissionType, checked) => {
    setNewRole(prev => {
      const currentStages = prev.counselingFormStages || {};
      const currentStage = currentStages[stageKey] || { can_read: false, can_update: false };
      
      return {
        ...prev,
        counselingFormStages: {
          ...currentStages,
          [stageKey]: {
            ...currentStage,
            [permissionType]: checked
          }
        }
      };
    });
  };

  const getRoleBadgeColor = (roleName) => {
    const colors = {
      super_admin: 'error',
      admin: 'error',
      dcm: 'primary',
      counselor: 'info',
      welfare_reviewer: 'warning',
      executive: 'success',
      finance: 'secondary',
    };
    return colors[roleName] || 'default';
  };

  const formatPermissions = (permissions) => {
    if (!permissions) return 'No permissions';
    
    try {
      // Handle both JSON object format and array format
      if (typeof permissions === 'string') {
        permissions = JSON.parse(permissions);
      }
      
      if (Array.isArray(permissions)) {
        // If it's an array of permission objects
        return permissions.map(p => `${p.resource}:${p.action}`).join(', ');
      } else if (typeof permissions === 'object') {
        // If it's an object with resource: actions format
        const permArray = Object.entries(permissions).flatMap(([resource, actions]) => {
          if (!Array.isArray(actions)) {
            return [];
          }
          return actions.map(action => `${resource}:${action}`);
        });
        return permArray.length > 0 ? permArray.join(', ') : 'No permissions';
      }
      
      return 'No permissions';
    } catch (error) {
      console.error('Error formatting permissions:', error);
      return 'Error loading permissions';
    }
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="p-6">
        <Alert severity="error">
          Access denied. Only super administrators can access role management.
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Role Management</h1>
            <p className="text-gray-600">Manage user roles and permissions</p>
          </div>
        <Button
            onClick={() => {
              setNewRole({ name: '', description: '', permissions: {}, counselingFormStages: {} });
              setCreateRoleModalOpen(true);
            }}
            className="flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Create Role</span>
        </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultTab={0}>
        <Tabs.Tab label="Roles">
          <Card>
            <div className="p-6">
              {rolesLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <Table>
                  <Table.Head>
                    <Table.Row>
                      <Table.Header>Role Name</Table.Header>
                      <Table.Header>Description</Table.Header>
                      <Table.Header>Users</Table.Header>
                      <Table.Header>Permissions</Table.Header>
                      <Table.Header>Status</Table.Header>
                      <Table.Header align="center">Actions</Table.Header>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {availableRoles?.roles?.map((role) => (
                      <React.Fragment key={role.id}>
                        <Table.Row hover>
                          <Table.Cell>
                            <div className="font-medium text-gray-900">
                              {editingRoleId === role.id ? (
                                <Input
                                  value={newRole.name}
                                  onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                                  placeholder="Role name"
                                  className="w-full"
                                  disabled={role.name === 'super_admin'}
                                />
                              ) : (
                                role.name
                              )}
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="text-sm text-gray-900">
                              {editingRoleId === role.id ? (
                                <textarea
                                  value={newRole.description}
                                  onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                                  rows={2}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                  placeholder="Role description"
                                  disabled={role.name === 'super_admin'}
                                />
                              ) : (
                                role.description || 'No description'
                              )}
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <Badge variant="info">
                              {role.user_count || 0} users
                          </Badge>
                          </Table.Cell>
                          <Table.Cell>
                            <div className="text-sm text-gray-600 max-w-xs truncate">
                              {formatPermissions(role.permissions)}
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <Badge variant={role.is_active ? 'success' : 'error'}>
                              {role.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          </Table.Cell>
                          <Table.Cell align="center">
                            <div className="flex items-center justify-center space-x-2">
                              {editingRoleId === role.id ? (
                                <>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handleUpdateRole}
                                    loading={updateRoleMutation.isLoading}
                                    className="flex items-center space-x-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Save</span>
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    className="flex items-center space-x-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    <span>Cancel</span>
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditRole(role)}
                                    className="flex items-center space-x-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    <span>Edit</span>
                                  </Button>
                                  {role.name !== 'super_admin' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteRole(role.id)}
                                      className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      <span>Delete</span>
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </Table.Cell>
                        </Table.Row>
                        
                        {/* Permissions Row - Only show when editing */}
                        {editingRoleId === role.id && (
                          <Table.Row>
                            <Table.Cell colSpan={6} className="bg-gray-50">
                              <div className="p-4">
                                <h4 className="font-medium text-gray-900 mb-4">Permissions</h4>
                                <div className="space-y-4">
                                  {availablePermissions?.permissions?.map((permission) => (
                                    <div key={permission.resource} className="border border-gray-200 rounded-lg p-4">
                                      <h5 className="font-medium text-gray-900 mb-2 capitalize">
                                        {permission.resource.replace('_', ' ')}
                                      </h5>
                                      <div className="grid grid-cols-2 gap-2">
                                        {permission.actions.map((action) => {
                                          const resourcePermissions = newRole.permissions[permission.resource];
                                          const isChecked = resourcePermissions?.includes(action) || false;
                                          const isSuperAdmin = role.name === 'super_admin';
                                          
                                          return (
                                            <Switch
                                              key={action}
                                              label={action}
                                              checked={isSuperAdmin || isChecked}
                                              onChange={(checked) => handlePermissionChange(permission.resource, action, checked)}
                                              disabled={isSuperAdmin}
                                              className={isSuperAdmin ? 'opacity-50' : ''}
                                            />
                                          );
                                        })}
                                      </div>
                                      
                                      {/* Show stage-level permissions for counseling forms */}
                                      {permission.resource === 'counseling_forms' && permission.stages && permission.stages.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-gray-200">
                                          <h6 className="text-sm font-medium text-gray-700 mb-3">Stage Permissions</h6>
                                          <div className="space-y-3">
                                            {permission.stages.map((stage) => {
                                              const stagePerm = newRole.counselingFormStages?.[stage.key] || { can_read: false, can_update: false };
                                              const isSuperAdmin = role.name === 'super_admin';
                                              
                                              return (
                                                <div key={stage.key} className="pl-4 border-l-2 border-gray-100">
                                                  <div className="font-medium text-sm text-gray-800 mb-2">
                                                    {stage.name || stage.key}
                                                  </div>
                                                  <div className="grid grid-cols-2 gap-2">
                                                    <Switch
                                                      label="Read"
                                                      checked={isSuperAdmin || stagePerm.can_read}
                                                      onChange={(checked) => handleStagePermissionChange(stage.key, 'can_read', checked)}
                                                      disabled={isSuperAdmin}
                                                      className={isSuperAdmin ? 'opacity-50' : ''}
                                                    />
                                                    <Switch
                                                      label="Update"
                                                      checked={isSuperAdmin || stagePerm.can_update}
                                                      onChange={(checked) => handleStagePermissionChange(stage.key, 'can_update', checked)}
                                                      disabled={isSuperAdmin}
                                                      className={isSuperAdmin ? 'opacity-50' : ''}
                                                    />
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </Table.Cell>
                          </Table.Row>
                        )}
                      </React.Fragment>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </div>
          </Card>
        </Tabs.Tab>

        <Tabs.Tab label="User Roles">
          <Card>
            <div className="p-6">
              {usersLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <Table>
                  <Table.Head>
                    <Table.Row>
                      <Table.Header>User</Table.Header>
                      <Table.Header>Email</Table.Header>
                      <Table.Header>Current Role</Table.Header>
                      <Table.Header>Assign Role</Table.Header>
                      <Table.Header>Status</Table.Header>
                    </Table.Row>
                  </Table.Head>
                  <Table.Body>
                    {availableUsers?.users?.map((userItem) => (
                      <Table.Row key={userItem.id} hover>
                        <Table.Cell>
                          <div className="font-medium text-gray-900">
                            {userItem.full_name}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="text-sm text-gray-900">
                            {userItem.email}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant={getRoleBadgeColor(userItem.role)}>
                            {userItem.role}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Select
                            value={userItem.role}
                            onChange={(e) => {
                              if (e.target.value !== userItem.role) {
                                const role = rolesData?.roles?.find(r => r.name === e.target.value);
                                if (role) {
                                  assignRoleMutation.mutate({
                                    userId: userItem.id,
                                    roleId: role.id
                                  });
                                }
                              }
                            }}
                            className="w-40"
                          >
                            {availableRoles?.roles?.map((role) => (
                              <Select.Option key={role.id} value={role.name}>
                                {role.name}
                              </Select.Option>
                            ))}
                          </Select>
                        </Table.Cell>
                        <Table.Cell>
                          <Badge variant={userItem.is_active === 0 ? 'success' : 'error'}>
                            {userItem.is_active === 0 ? 'Active' : 'Inactive'}
                          </Badge>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              )}
            </div>
            </Card>
        </Tabs.Tab>
      </Tabs>

      {/* Create Role Modal */}
      <Modal
        isOpen={createRoleModalOpen}
        onClose={() => setCreateRoleModalOpen(false)}
        title="Create New Role"
        size="lg"
      >
        <div className="space-y-6">
          <Input
                  label="Role Name"
            value={newRole.name}
            onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter role name"
                  required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={newRole.description}
              onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter role description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
                  Permissions
            </label>
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {availablePermissions?.permissions?.map((permission) => (
                <div key={permission.resource} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2 capitalize">
                        {permission.resource.replace('_', ' ')}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                        {permission.actions.map((action) => (
                      <Switch
                            key={action}
                        label={action}
                        checked={newRole.permissions[permission.resource]?.includes(action) || false}
                        onChange={(checked) => handlePermissionChange(permission.resource, action, checked)}
                          />
                        ))}
                  </div>
                  
                  {/* Show stage-level permissions for counseling forms */}
                  {permission.resource === 'counseling_forms' && permission.stages && permission.stages.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h6 className="text-sm font-medium text-gray-700 mb-3">Stage Permissions</h6>
                      <div className="space-y-3">
                        {permission.stages.map((stage) => {
                          const stagePerm = newRole.counselingFormStages?.[stage.key] || { can_read: false, can_update: false };
                          
                          return (
                            <div key={stage.key} className="pl-4 border-l-2 border-gray-100">
                              <div className="font-medium text-sm text-gray-800 mb-2">
                                {stage.name || stage.key}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Switch
                                  label="Read"
                                  checked={stagePerm.can_read}
                                  onChange={(checked) => handleStagePermissionChange(stage.key, 'can_read', checked)}
                                />
                                <Switch
                                  label="Update"
                                  checked={stagePerm.can_update}
                                  onChange={(checked) => handleStagePermissionChange(stage.key, 'can_update', checked)}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <Modal.Footer>
          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={() => setCreateRoleModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateRole}
              loading={createRoleMutation.isLoading}
              disabled={!newRole.name || createRoleMutation.isLoading}
            >
              Create Role
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

    </div>
  );
};

export default RoleManagement;
