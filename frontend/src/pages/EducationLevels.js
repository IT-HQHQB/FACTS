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

const EducationLevels = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEducation, setEditingEducation] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const queryClient = useQueryClient();

  // Fetch education levels
  const { data: educationLevels, isLoading, isError } = useQuery(
    'educationLevels',
    () => axios.get('/api/education-levels').then(res => res.data),
    {
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to load education levels');
      }
    }
  );

  // Create education level mutation
  const createMutation = useMutation(
    (data) => axios.post('/api/education-levels', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('educationLevels');
        setSuccess('Education level created successfully!');
        setError('');
        setIsModalOpen(false);
        setFormData({ name: '', description: '' });
        setTimeout(() => setSuccess(''), 3000);
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to create education level');
        setSuccess('');
      }
    }
  );

  // Update education level mutation
  const updateMutation = useMutation(
    ({ id, data }) => axios.put(`/api/education-levels/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('educationLevels');
        setSuccess('Education level updated successfully!');
        setError('');
        setIsModalOpen(false);
        setEditingEducation(null);
        setFormData({ name: '', description: '' });
        setTimeout(() => setSuccess(''), 3000);
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to update education level');
        setSuccess('');
      }
    }
  );

  // Delete education level mutation
  const deleteMutation = useMutation(
    (id) => axios.delete(`/api/education-levels/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('educationLevels');
        setSuccess('Education level deleted successfully!');
        setError('');
        setTimeout(() => setSuccess(''), 3000);
      },
      onError: (error) => {
        setError(error.response?.data?.error || 'Failed to delete education level');
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

    if (editingEducation) {
      updateMutation.mutate({ id: editingEducation.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (education) => {
    setEditingEducation(education);
    setFormData({ name: education.name, description: education.description || '' });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this education level?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEducation(null);
    setFormData({ name: '', description: '' });
    setError('');
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (education) => (
        <div className="font-medium text-gray-900">{education.name}</div>
      )
    },
    {
      key: 'description',
      label: 'Description',
      render: (education) => (
        <div className="text-gray-600">{education.description || '-'}</div>
      )
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (education) => (
        <Badge variant={education.is_active ? 'success' : 'danger'}>
          {education.is_active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (education) => (
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEdit(education)}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleDelete(education.id)}
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
          Failed to load education levels. Please try again.
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Education Levels Management</h1>
            <p className="text-gray-600">Manage education levels for family members in counseling forms</p>
          </div>
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="primary"
          >
            Add New Education Level
          </Button>
        </div>
      </div>

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {success && <Alert variant="success" className="mb-4">{success}</Alert>}

      <Card className="p-6">
        <Table
          data={educationLevels || []}
          columns={columns}
          emptyMessage="No education levels found"
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingEducation ? 'Edit Education Level' : 'Add New Education Level'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Enter education level (e.g., Graduate, Post Graduate, PhD)"
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
              {editingEducation ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default EducationLevels;
