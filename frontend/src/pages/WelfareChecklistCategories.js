import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button, Input, Table, Modal, Alert, Chip } from '../components/ui';

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

const WelfareChecklistCategories = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formData, setFormData] = useState({
    category_name: '',
    description: '',
    sort_order: '',
    is_active: true
  });

  // Fetch categories
  const { data: categoriesData, isLoading, error } = useQuery(
    'welfareChecklistCategories',
    () => axios.get('/api/welfare-checklist/categories').then(res => res.data),
    {
      enabled: user?.role === 'super_admin' || user?.role === 'admin',
      retry: false,
    }
  );

  // Create category mutation
  const createMutation = useMutation(
    async (newCategory) => {
      const response = await axios.post('/api/welfare-checklist/categories', newCategory);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('welfareChecklistCategories');
        setIsCreateModalOpen(false);
        resetForm();
      }
    }
  );

  // Update category mutation
  const updateMutation = useMutation(
    async ({ id, ...updateData }) => {
      const response = await axios.put(`/api/welfare-checklist/categories/${id}`, updateData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('welfareChecklistCategories');
        setIsEditModalOpen(false);
        resetForm();
      }
    }
  );

  // Delete category mutation
  const deleteMutation = useMutation(
    async (id) => {
      const response = await axios.delete(`/api/welfare-checklist/categories/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('welfareChecklistCategories');
        setIsDeleteModalOpen(false);
        setSelectedCategory(null);
      }
    }
  );

  const resetForm = () => {
    setFormData({
      category_name: '',
      description: '',
      sort_order: '',
      is_active: true
    });
    setSelectedCategory(null);
  };

  const handleCreate = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleEdit = (category) => {
    setSelectedCategory(category);
    setFormData({
      category_name: category.category_name,
      description: category.description || '',
      sort_order: category.sort_order,
      is_active: category.is_active
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = (category) => {
    setSelectedCategory(category);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isCreateModalOpen) {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate({ id: selectedCategory.id, ...formData });
    }
  };

  if (user?.role !== 'super_admin' && user?.role !== 'admin') {
    return (
      <div className="p-6">
        <Alert severity="error">
          Access denied. Only administrators can access checklist categories management.
        </Alert>
      </div>
    );
  }

  if (isLoading) return <div className="flex justify-center items-center h-64">Loading...</div>;
  if (error) return <div className="text-red-600">Error: {error.message}</div>;

  const categories = categoriesData?.categories || [];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welfare Checklist Categories</h1>
          <p className="text-gray-600 text-lg">
            Manage categories for organizing checklist items (e.g., "Basic Details", "Counsellor's Assessment & Recommendations")
          </p>
        </div>

        {/* Actions */}
        <div className="mb-6 flex space-x-4">
          <Button
            onClick={handleCreate}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <PlusIcon />
            Add Category
          </Button>
        </div>

        {/* Categories Table */}
        <Card className="p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Categories</h2>
            <p className="text-sm text-gray-600 mt-1">
              Organize checklist items into logical groups
            </p>
          </div>

          {categories.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <PlusIcon />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Categories</h3>
              <p className="text-lg text-gray-600 mb-6">
                Get started by creating your first checklist category
              </p>
              <Button
                onClick={handleCreate}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <PlusIcon />
                Create First Category
              </Button>
            </div>
          ) : (
            <Table>
              <Table.Head>
                <Table.Row>
                  <Table.Header>Sort Order</Table.Header>
                  <Table.Header>Category Name</Table.Header>
                  <Table.Header>Description</Table.Header>
                  <Table.Header>Items Count</Table.Header>
                  <Table.Header>Status</Table.Header>
                  <Table.Header>Actions</Table.Header>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {categories.map((category) => (
                  <Table.Row key={category.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <Table.Cell>
                      <span className="font-medium">{category.sort_order}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="font-medium text-gray-900">{category.category_name}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-gray-600">{category.description || 'No description'}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-gray-600">{category.items_count || 0}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip
                        variant={category.is_active ? 'success' : 'secondary'}
                        size="sm"
                      >
                        {category.is_active ? 'Active' : 'Inactive'}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(category)}
                          className="flex items-center justify-center px-3 py-1 text-xs font-medium border-0 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <EditIcon />
                          <span className="ml-1">Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(category)}
                          className="flex items-center justify-center px-3 py-1 text-xs font-medium border-0 bg-red-600 hover:bg-red-700 text-white"
                        >
                          <TrashIcon />
                          <span className="ml-1">Delete</span>
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
          title="Create Checklist Category"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Category Name *"
              value={formData.category_name}
              onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
              placeholder="e.g., Basic Details"
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter category description"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <Input
              label="Sort Order *"
              type="number"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              placeholder="0"
              required
            />
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
                {createMutation.isLoading ? 'Creating...' : 'Create Category'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Checklist Category"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Category Name *"
              value={formData.category_name}
              onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
              placeholder="e.g., Basic Details"
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter category description"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <Input
              label="Sort Order *"
              type="number"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              placeholder="0"
              required
            />
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Active
              </label>
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
                {updateMutation.isLoading ? 'Updating...' : 'Update Category'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Delete Modal */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Delete Checklist Category"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete the category "{selectedCategory?.category_name}"?
            </p>
            <p className="text-sm text-red-600">
              This action cannot be undone. Make sure there are no items in this category.
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
                onClick={() => deleteMutation.mutate(selectedCategory.id)}
                disabled={deleteMutation.isLoading}
              >
                {deleteMutation.isLoading ? 'Deleting...' : 'Delete Category'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default WelfareChecklistCategories;


















