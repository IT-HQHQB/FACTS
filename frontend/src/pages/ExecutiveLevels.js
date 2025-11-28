import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { Card, Button, Input, Table, Modal, Select, Chip } from '../components/ui';

// Icon components
const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ArrowUpIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const SaveIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PeopleIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
  </svg>
);

const PowerOffIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
  </svg>
);

const ExecutiveLevels = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    level_number: '',
    level_name: '',
    description: '',
    sort_order: '',
    is_active: true
  });

  const queryClient = useQueryClient();

  // Fetch executive levels
  const { data: levelsData, isLoading, error } = useQuery(
    'executiveLevels',
    () => axios.get('/api/executive-levels').then(res => {
      console.log('🔍 Executive Levels API Response:', res.data);
      console.log('🔍 Response data keys:', Object.keys(res.data));
      return res.data;
    })
  );

  // Fetch users with executive role
  const { data: executiveUsersData } = useQuery(
    'executiveUsers',
    () => axios.get('/api/users', { params: { role: 'Executive Management' } }).then(res => {
      console.log('🔍 Executive Users API Response:', res.data);
      return res.data;
    }),
    {
      select: (data) => {
        console.log('🔍 Executive Users processed data:', data.users || []);
        return data.users || [];
      },
    }
  );

  // Create executive level mutation
  const createMutation = useMutation(
    async (newLevel) => {
      const response = await axios.post('/api/executive-levels', newLevel);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('executiveLevels');
        setIsCreateModalOpen(false);
        resetForm();
      }
    }
  );

  // Update executive level mutation
  const updateMutation = useMutation(
    async ({ id, ...updateData }) => {
      const response = await axios.put(`/api/executive-levels/${id}`, updateData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('executiveLevels');
        setIsEditModalOpen(false);
        resetForm();
      }
    }
  );

  // Delete executive level mutation
  const deleteMutation = useMutation(
    async (id) => {
      const response = await axios.delete(`/api/executive-levels/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('executiveLevels');
        setIsDeleteModalOpen(false);
        setSelectedLevel(null);
      }
    }
  );

  // Reorder executive levels mutation
  const reorderMutation = useMutation(
    async (levels) => {
      const response = await axios.put('/api/executive-levels/reorder', { levels });
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('executiveLevels');
      }
    }
  );

  // Assign user to executive level mutation
  const assignUserMutation = useMutation(
    async ({ userId, executiveLevel }) => {
      console.log('Assigning user:', { userId, executiveLevel });
      const response = await axios.put(`/api/users/${userId}/assign-executive-level`, { executive_level: executiveLevel });
      return response.data;
    },
    {
      onSuccess: (data) => {
        console.log('User assigned successfully:', data);
        // Invalidate and refetch queries
        queryClient.invalidateQueries('executiveLevels');
        queryClient.invalidateQueries('executiveUsers');
        // Force refetch the executive levels data
        queryClient.refetchQueries('executiveLevels');
        alert('User assigned successfully!');
      },
      onError: (error) => {
        console.error('Error assigning user:', error);
        alert(`Failed to assign user: ${error.response?.data?.error || error.message}`);
      }
    }
  );

  // Unassign user from executive level mutation
  const unassignUserMutation = useMutation(
    async ({ userId }) => {
      console.log('Unassigning user:', { userId });
      const response = await axios.put(`/api/users/${userId}/assign-executive-level`, { executive_level: null });
      return response.data;
    },
    {
      onSuccess: (data) => {
        console.log('User unassigned successfully:', data);
        // Invalidate and refetch queries
        queryClient.invalidateQueries('executiveLevels');
        queryClient.invalidateQueries('executiveUsers');
        // Force refetch the executive levels data
        queryClient.refetchQueries('executiveLevels');
        alert('User unassigned successfully!');
      },
      onError: (error) => {
        console.error('Error unassigning user:', error);
        alert(`Failed to unassign user: ${error.response?.data?.error || error.message}`);
      }
    }
  );

  const resetForm = () => {
    setFormData({
      level_number: '',
      level_name: '',
      description: '',
      sort_order: '',
      is_active: true
    });
    setSelectedLevel(null);
  };

  const handleCreate = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleEdit = (level) => {
    setSelectedLevel(level);
    setSelectedUser(null); // Reset selected user when opening edit modal
    setFormData({
      level_number: level.level_number,
      level_name: level.level_name,
      description: level.description || '',
      sort_order: level.sort_order,
      is_active: level.is_active
    });
    // Refresh executive users data to get latest assignments
    queryClient.invalidateQueries('executiveUsers');
    setIsEditModalOpen(true);
  };

  const handleDelete = (level) => {
    setSelectedLevel(level);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isCreateModalOpen) {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate({ id: selectedLevel.id, ...formData });
    }
  };

  const handleMoveUp = (level) => {
    const levels = levelsData.levels || [];
    const currentIndex = levels.findIndex(l => l.id === level.id);
    if (currentIndex > 0) {
      const newLevels = [...levels];
      [newLevels[currentIndex], newLevels[currentIndex - 1]] = [newLevels[currentIndex - 1], newLevels[currentIndex]];
      
      // Update sort orders
      const updatedLevels = newLevels.map((l, index) => ({
        id: l.id,
        sort_order: index + 1
      }));
      
      reorderMutation.mutate(updatedLevels);
    }
  };

  const handleMoveDown = (level) => {
    const levels = levelsData.levels || [];
    const currentIndex = levels.findIndex(l => l.id === level.id);
    if (currentIndex < levels.length - 1) {
      const newLevels = [...levels];
      [newLevels[currentIndex], newLevels[currentIndex + 1]] = [newLevels[currentIndex + 1], newLevels[currentIndex]];
      
      // Update sort orders
      const updatedLevels = newLevels.map((l, index) => ({
        id: l.id,
        sort_order: index + 1
      }));
      
      reorderMutation.mutate(updatedLevels);
    }
  };

  const handleToggleActive = (level) => {
    updateMutation.mutate({
      id: level.id,
      level_number: level.level_number,
      level_name: level.level_name,
      description: level.description,
      sort_order: level.sort_order,
      is_active: !level.is_active
    });
  };

  const handleAssignUser = (userId, executiveLevel) => {
    assignUserMutation.mutate({ userId, executiveLevel });
  };

  const handleAssignUserInEdit = () => {
    console.log('handleAssignUserInEdit called', { selectedUser, selectedLevel });
    if (selectedUser && selectedLevel) {
      console.log('Calling handleAssignUser with:', { userId: selectedUser.id, executiveLevel: selectedLevel.level_number });
      handleAssignUser(selectedUser.id, selectedLevel.level_number);
      setSelectedUser(null);
    } else {
      console.log('Missing selectedUser or selectedLevel:', { selectedUser, selectedLevel });
    }
  };

  const handleUnassignUser = (userId) => {
    unassignUserMutation.mutate({ userId });
  };

  // Get users currently assigned to the selected level
  const getAssignedUsers = () => {
    if (!selectedLevel || !executiveUsersData) return [];
    return executiveUsersData.filter(user => user.executive_level === selectedLevel.level_number);
  };

  if (isLoading) return <div className="flex justify-center items-center h-64">Loading...</div>;
  if (error) return <div className="text-red-600">Error: {error.message}</div>;

  const levels = levelsData?.levels || levelsData?.Levels || [];
  console.log('🔍 Levels data for table:', levels);
  console.log('🔍 Full levelsData object:', levelsData);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Executive Levels Management</h1>
          <p className="text-gray-600 text-lg">
            Configure and manage executive approval levels for the case workflow
          </p>
        </div>

        {/* Actions */}
        <div className="mb-6 flex space-x-4">
          <Button
            onClick={handleCreate}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <PlusIcon />
            Add Executive Level
          </Button>
        </div>

        {/* Executive Levels Table */}
        <Card className="p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Executive Levels</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage the hierarchy and configuration of executive approval levels
            </p>
          </div>

          {levels.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <PlusIcon />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Executive Levels</h3>
              <p className="text-lg text-gray-600 mb-6">
                Get started by creating your first executive level
              </p>
              <Button
                onClick={handleCreate}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <PlusIcon />
                Create First Executive Level
              </Button>
            </div>
          ) : (
            <Table>
              <Table.Head>
                <Table.Row>
                  <Table.Header>Order</Table.Header>
                  <Table.Header>Level Number</Table.Header>
                  <Table.Header>Level Name</Table.Header>
                  <Table.Header>Description</Table.Header>
                  <Table.Header>Status</Table.Header>
                  <Table.Header>Assigned Users</Table.Header>
                  <Table.Header>Active Cases</Table.Header>
                  <Table.Header>Actions</Table.Header>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {levels.map((level, index) => (
                  <Table.Row key={level.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <Table.Cell>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{level.sort_order}</span>
                        <div className="flex flex-col">
                          <button
                            onClick={() => handleMoveUp(level)}
                            disabled={index === 0}
                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ArrowUpIcon />
                          </button>
                          <button
                            onClick={() => handleMoveDown(level)}
                            disabled={index === levels.length - 1}
                            className="p-1 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ArrowDownIcon />
                          </button>
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-medium text-primary-600">{level.level_number}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-medium text-gray-900">{level.level_name}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-gray-600">{level.description || 'No description'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip
                        variant={level.is_active ? 'success' : 'secondary'}
                        size="sm"
                      >
                        {level.is_active ? 'Active' : 'Inactive'}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-gray-600">{level.assigned_users_count || 0}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-gray-600">{level.active_cases_count || 0}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(level)}
                          className="flex items-center justify-center px-3 py-1 text-xs font-medium border-0 bg-blue-600 hover:bg-blue-700 text-white"
                          title="Edit"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(level)}
                          className={`flex items-center justify-center px-3 py-1 text-xs font-medium border-0 text-white ${
                            level.is_active 
                              ? 'bg-red-600 hover:bg-red-700' 
                              : 'bg-green-600 hover:bg-green-700'
                          }`}
                          title={level.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {level.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(level)}
                          className="flex items-center justify-center px-3 py-1 text-xs font-medium border-0 bg-red-600 hover:bg-red-700 text-white"
                          title="Delete"
                        >
                          Delete
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </Card>

        {/* Create Modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create Executive Level"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Level Number *
              </label>
              <Input
                type="number"
                value={formData.level_number}
                onChange={(e) => setFormData({ ...formData, level_number: parseInt(e.target.value) })}
                placeholder="Enter level number"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Level Name *
              </label>
              <Input
                value={formData.level_name}
                onChange={(e) => setFormData({ ...formData, level_name: e.target.value })}
                placeholder="Enter level name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort Order *
              </label>
              <Input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                placeholder="Enter sort order"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <Select
                value={formData.is_active ? 'active' : 'inactive'}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isLoading}
                className="bg-primary-600 hover:bg-primary-700 text-white"
              >
                {createMutation.isLoading ? 'Creating...' : 'Create Level'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Executive Level"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Level Number *
              </label>
              <Input
                type="number"
                value={formData.level_number}
                onChange={(e) => setFormData({ ...formData, level_number: parseInt(e.target.value) })}
                placeholder="Enter level number"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Level Name *
              </label>
              <Input
                value={formData.level_name}
                onChange={(e) => setFormData({ ...formData, level_name: e.target.value })}
                placeholder="Enter level name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort Order *
              </label>
              <Input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                placeholder="Enter sort order"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <Select
                value={formData.is_active ? 'active' : 'inactive'}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>

            {/* Currently Assigned Users Section */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Currently Assigned Users</h3>
              {getAssignedUsers().length > 0 ? (
                <div className="space-y-2">
                  {getAssignedUsers().map((user) => (
                    <div key={user.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{user.full_name}</p>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnassignUser(user.id)}
                        disabled={unassignUserMutation.isLoading}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      >
                        {unassignUserMutation.isLoading ? 'Unassigning...' : 'Unassign'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <p>No users currently assigned to this level</p>
                </div>
              )}
            </div>

            {/* User Assignment Section */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Assign New User</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select User to Assign
                  </label>
                  <Select
                    value={selectedUser?.id || ''}
                    onChange={(e) => {
                      const userId = parseInt(e.target.value);
                      const user = executiveUsersData?.find(u => u.id === userId);
                      setSelectedUser(user);
                    }}
                  >
                    <option value="">Select a user...</option>
                    {executiveUsersData?.filter(user => user.executive_level !== selectedLevel?.level_number).map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name} {user.executive_level ? `(Currently: Level ${user.executive_level})` : '(Unassigned)'}
                      </option>
                    ))}
                  </Select>
                </div>
                
                {selectedUser && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Selected User:</strong> {selectedUser.full_name}
                    </p>
                    <p className="text-sm text-blue-600">
                      <strong>Current Level:</strong> {selectedUser.executive_level ? `Level ${selectedUser.executive_level}` : 'Unassigned'}
                    </p>
                    <p className="text-sm text-blue-600">
                      <strong>Will be assigned to:</strong> {selectedLevel?.level_name}
                    </p>
                  </div>
                )}

                {selectedUser && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleAssignUserInEdit}
                      disabled={assignUserMutation.isLoading || !selectedUser}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {assignUserMutation.isLoading ? 'Assigning...' : 'Assign User'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isLoading}
                className="bg-primary-600 hover:bg-primary-700 text-white"
              >
                {updateMutation.isLoading ? 'Updating...' : 'Update Level'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Delete Modal */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Delete Executive Level"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete the executive level "{selectedLevel?.level_name}"?
            </p>
            <p className="text-sm text-red-600">
              This action cannot be undone. Make sure there are no users assigned to this level and no active cases.
            </p>
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteMutation.mutate(selectedLevel.id)}
                disabled={deleteMutation.isLoading}
              >
                {deleteMutation.isLoading ? 'Deleting...' : 'Delete Level'}
              </Button>
            </div>
          </div>
        </Modal>

      </div>
    </div>
  );
};

export default ExecutiveLevels;
