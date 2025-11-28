import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { 
  Button, 
  Input, 
  Card, 
  Alert,
  Table,
  Modal,
  Badge
} from '../components/ui';

const Relations = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRelation, setEditingRelation] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const queryClient = useQueryClient();

  // Fetch relations
  const { data: relations, isLoading, isError } = useQuery(
    'relations',
    () => axios.get('/api/relations').then(res => res.data),
    {
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to load relations');
      }
    }
  );

  // Create relation mutation
  const createMutation = useMutation(
    (data) => axios.post('/api/relations', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('relations');
        setSuccess('Relation created successfully!');
        setError('');
        setIsModalOpen(false);
        setFormData({ name: '', description: '' });
        setTimeout(() => setSuccess(''), 3000);
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to create relation');
        setSuccess('');
      }
    }
  );

  // Update relation mutation
  const updateMutation = useMutation(
    ({ id, data }) => axios.put(`/api/relations/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('relations');
        setSuccess('Relation updated successfully!');
        setError('');
        setIsModalOpen(false);
        setEditingRelation(null);
        setFormData({ name: '', description: '' });
        setTimeout(() => setSuccess(''), 3000);
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to update relation');
        setSuccess('');
      }
    }
  );

  // Delete relation mutation
  const deleteMutation = useMutation(
    (id) => axios.delete(`/api/relations/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('relations');
        setSuccess('Relation deleted successfully!');
        setError('');
        setTimeout(() => setSuccess(''), 3000);
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to delete relation');
        setSuccess('');
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (editingRelation) {
      updateMutation.mutate({ id: editingRelation.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (relation) => {
    setEditingRelation(relation);
    setFormData({ name: relation.name, description: relation.description || '' });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this relation?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRelation(null);
    setFormData({ name: '', description: '' });
    setError('');
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (relation) => (
        <div className="font-medium text-gray-900">{relation.name}</div>
      )
    },
    {
      key: 'description',
      label: 'Description',
      render: (relation) => (
        <div className="text-gray-600">{relation.description || '-'}</div>
      )
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (relation) => (
        <Badge variant={relation.is_active ? 'success' : 'danger'}>
          {relation.is_active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (relation) => (
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(relation)}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleDelete(relation.id)}
            disabled={deleteMutation.isLoading}
          >
            Delete
          </Button>
        </div>
      )
    }
  ];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <Alert variant="error">
          Failed to load relations. Please try again.
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Relations Management</h1>
            <p className="text-gray-600">Manage family relationship types for counseling forms</p>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
          >
            Add New Relation
          </Button>
        </div>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {success && <Alert variant="success" className="mb-4">{success}</Alert>}

      <Card className="p-6">
        <Table
          data={relations || []}
          columns={columns}
          emptyMessage="No relations found"
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingRelation ? 'Edit Relation' : 'Add New Relation'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Enter relation name (e.g., Father, Mother, Son)"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter description (optional)"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseModal}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createMutation.isLoading || updateMutation.isLoading}
            >
              {editingRelation ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Relations;
