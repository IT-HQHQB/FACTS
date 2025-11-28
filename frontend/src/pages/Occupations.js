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

const Occupations = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOccupation, setEditingOccupation] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const queryClient = useQueryClient();

  // Fetch occupations
  const { data: occupations, isLoading, isError } = useQuery(
    'occupations',
    () => axios.get('/api/occupations').then(res => res.data),
    {
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to load occupations');
      }
    }
  );

  // Create occupation mutation
  const createMutation = useMutation(
    (data) => axios.post('/api/occupations', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('occupations');
        setSuccess('Occupation created successfully!');
        setError('');
        setIsModalOpen(false);
        setFormData({ name: '', description: '' });
        setTimeout(() => setSuccess(''), 3000);
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to create occupation');
        setSuccess('');
      }
    }
  );

  // Update occupation mutation
  const updateMutation = useMutation(
    ({ id, data }) => axios.put(`/api/occupations/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('occupations');
        setSuccess('Occupation updated successfully!');
        setError('');
        setIsModalOpen(false);
        setEditingOccupation(null);
        setFormData({ name: '', description: '' });
        setTimeout(() => setSuccess(''), 3000);
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to update occupation');
        setSuccess('');
      }
    }
  );

  // Delete occupation mutation
  const deleteMutation = useMutation(
    (id) => axios.delete(`/api/occupations/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('occupations');
        setSuccess('Occupation deleted successfully!');
        setError('');
        setTimeout(() => setSuccess(''), 3000);
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to delete occupation');
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

    if (editingOccupation) {
      updateMutation.mutate({ id: editingOccupation.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (occupation) => {
    setEditingOccupation(occupation);
    setFormData({ name: occupation.name, description: occupation.description || '' });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this occupation?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingOccupation(null);
    setFormData({ name: '', description: '' });
    setError('');
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (occupation) => (
        <div className="font-medium text-gray-900">{occupation.name}</div>
      )
    },
    {
      key: 'description',
      label: 'Description',
      render: (occupation) => (
        <div className="text-gray-600">{occupation.description || '-'}</div>
      )
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (occupation) => (
        <Badge variant={occupation.is_active ? 'success' : 'danger'}>
          {occupation.is_active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (occupation) => (
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(occupation)}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleDelete(occupation.id)}
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
          Failed to load occupations. Please try again.
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Occupations Management</h1>
            <p className="text-gray-600">Manage occupation types for family members in counseling forms</p>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
          >
            Add New Occupation
          </Button>
        </div>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {success && <Alert variant="success" className="mb-4">{success}</Alert>}

      <Card className="p-6">
        <Table
          data={occupations || []}
          columns={columns}
          emptyMessage="No occupations found"
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingOccupation ? 'Edit Occupation' : 'Add New Occupation'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Enter occupation (e.g., Business Owner, Employee - Private, Teacher)"
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
              {editingOccupation ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Occupations;
