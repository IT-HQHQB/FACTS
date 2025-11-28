import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { 
  Button, 
  Input, 
  Card, 
  Table, 
  Modal, 
  Alert,
  Chip
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

const CaseTypes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCaseType, setEditingCaseType] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm();

  // Fetch case types
  const { data: caseTypesData, isLoading, error: fetchError } = useQuery(
    'caseTypes',
    () => axios.get('/api/case-types').then(res => res.data),
    {
      select: (data) => data.caseTypes || [],
    }
  );

  // Create case type mutation
  const createMutation = useMutation(
    (caseTypeData) => axios.post('/api/case-types', caseTypeData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('caseTypes');
        setSuccess('Case type created successfully!');
        setError('');
        setModalOpen(false);
        reset();
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to create case type');
        setSuccess('');
      },
    }
  );

  // Update case type mutation
  const updateMutation = useMutation(
    ({ id, data }) => axios.put(`/api/case-types/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('caseTypes');
        setSuccess('Case type updated successfully!');
        setError('');
        setModalOpen(false);
        setEditingCaseType(null);
        reset();
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to update case type');
        setSuccess('');
      },
    }
  );

  // Delete case type mutation
  const deleteMutation = useMutation(
    (id) => axios.delete(`/api/case-types/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('caseTypes');
        setSuccess('Case type deleted successfully!');
        setError('');
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to delete case type');
        setSuccess('');
      },
    }
  );

  const onSubmit = async (data) => {
    setError('');
    setSuccess('');

    if (editingCaseType) {
      updateMutation.mutate({ id: editingCaseType.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (caseType) => {
    setEditingCaseType(caseType);
    setValue('name', caseType.name);
    setValue('description', caseType.description || '');
    setValue('sort_order', caseType.sort_order || 0);
    setValue('is_active', caseType.is_active);
    setModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this case type?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setEditingCaseType(null);
    setError('');
    setSuccess('');
    reset();
  };

  if (fetchError) {
    return (
      <div className="p-6">
        <Alert severity="error">
          Error loading case types: {fetchError.message}
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Case Types</h1>
            <p className="text-gray-600">Manage case types for the system</p>
          </div>
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <Button
              onClick={() => setModalOpen(true)}
              className="flex items-center space-x-2"
            >
              <AddIcon />
              <span>Add Case Type</span>
            </Button>
          )}
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

      {/* Case Types Table */}
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
                  Case Types ({caseTypesData?.length || 0})
                </h3>
              </div>
              
              <Table>
                <Table.Head>
                  <Table.Row>
                    <Table.Header>Name</Table.Header>
                    <Table.Header>Description</Table.Header>
                    <Table.Header>Sort Order</Table.Header>
                    <Table.Header>Status</Table.Header>
                    <Table.Header>Created</Table.Header>
                    <Table.Header align="center">Actions</Table.Header>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {caseTypesData?.map((caseType) => (
                    <Table.Row key={caseType.id} hover>
                      <Table.Cell>
                        <div className="font-medium text-gray-900">
                          {caseType.name}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="text-sm text-gray-900">
                          {caseType.description || 'N/A'}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="text-sm text-gray-900">
                          {caseType.sort_order}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip variant={caseType.is_active ? 'success' : 'error'}>
                          {caseType.is_active ? 'Active' : 'Inactive'}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="text-sm text-gray-900">
                          {new Date(caseType.created_at).toLocaleDateString()}
                        </div>
                      </Table.Cell>
                      <Table.Cell align="center">
                        {(user?.role === 'admin' || user?.role === 'super_admin') && (
                          <div className="flex items-center justify-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(caseType)}
                              className="flex items-center space-x-1"
                            >
                              <EditIcon />
                              <span>Edit</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(caseType.id)}
                              className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                            >
                              <DeleteIcon />
                              <span>Delete</span>
                            </Button>
                          </div>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>

              {(!caseTypesData || caseTypesData.length === 0) && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No case types found</h3>
                  <p className="text-gray-600 mb-4">
                    Get started by creating your first case type.
                  </p>
                  {(user?.role === 'admin' || user?.role === 'super_admin') && (
                    <Button onClick={() => setModalOpen(true)}>
                      Add Case Type
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={handleModalClose}
        title={editingCaseType ? 'Edit Case Type' : 'Add New Case Type'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Name"
            required
            error={errors.name?.message}
            {...register('name', { 
              required: 'Name is required' 
            })}
            placeholder="Enter case type name"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter case type description"
            />
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

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              {...register('is_active')}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
              Active
            </label>
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
                {editingCaseType ? 'Update' : 'Create'} Case Type
              </Button>
            </div>
          </Modal.Footer>
        </form>
      </Modal>
    </div>
  );
};

export default CaseTypes;
