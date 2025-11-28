import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button, Input, Table, Modal, Alert, Chip, Select, Switch } from '../components/ui';

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

const WelfareChecklistItems = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [formData, setFormData] = useState({
    category_id: '',
    form_section: '',
    checklist_detail: '',
    sort_order: '',
    is_active: true,
    is_compulsory: false
  });

  // Fetch categories
  const { data: categoriesData } = useQuery(
    'welfareChecklistCategories',
    () => axios.get('/api/welfare-checklist/categories').then(res => res.data),
    {
      enabled: (user?.role === 'super_admin' || user?.role === 'admin') && !selectedCategory,
      retry: false,
    }
  );

  // Fetch items
  const { data: itemsData, isLoading, error } = useQuery(
    ['welfareChecklistItems', selectedCategory],
    () => {
      const url = selectedCategory 
        ? `/api/welfare-checklist/items?category_id=${selectedCategory}`
        : '/api/welfare-checklist/items';
      return axios.get(url).then(res => res.data);
    },
    {
      enabled: user?.role === 'super_admin' || user?.role === 'admin',
      retry: false,
    }
  );

  // Create item mutation
  const createMutation = useMutation(
    async (newItem) => {
      const response = await axios.post('/api/welfare-checklist/items', newItem);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('welfareChecklistItems');
        setIsCreateModalOpen(false);
        resetForm();
      }
    }
  );

  // Update item mutation
  const updateMutation = useMutation(
    async ({ id, ...updateData }) => {
      const response = await axios.put(`/api/welfare-checklist/items/${id}`, updateData);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('welfareChecklistItems');
        setIsEditModalOpen(false);
        resetForm();
      }
    }
  );

  // Delete item mutation
  const deleteMutation = useMutation(
    async (id) => {
      const response = await axios.delete(`/api/welfare-checklist/items/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('welfareChecklistItems');
        setIsDeleteModalOpen(false);
        setSelectedItem(null);
      }
    }
  );

  const resetForm = () => {
    setFormData({
      category_id: selectedCategory || '',
      form_section: '',
      checklist_detail: '',
      sort_order: '',
      is_active: true,
      is_compulsory: false
    });
    setSelectedItem(null);
  };

  const handleCreate = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setFormData({
      category_id: item.category_id || item.category?.id || '',
      form_section: item.form_section,
      checklist_detail: item.checklist_detail,
      sort_order: item.sort_order,
      is_active: item.is_active,
      is_compulsory: item.is_compulsory || false
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = (item) => {
    setSelectedItem(item);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isCreateModalOpen) {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate({ id: selectedItem.id, ...formData });
    }
  };

  if (user?.role !== 'super_admin' && user?.role !== 'admin') {
    return (
      <div className="p-6">
        <Alert severity="error">
          Access denied. Only administrators can access checklist items management.
        </Alert>
      </div>
    );
  }

  if (isLoading) return <div className="flex justify-center items-center h-64">Loading...</div>;
  if (error) return <div className="text-red-600">Error: {error.message}</div>;

  const categories = categoriesData?.categories || [];
  const items = itemsData?.items || [];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welfare Checklist Items</h1>
          <p className="text-gray-600 text-lg">
            Manage individual checklist items with form section numbers and details
          </p>
        </div>

        {/* Filter by Category */}
        <div className="mb-6">
          <Card className="p-4">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Filter by Category:</label>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-64"
              >
                <Select.Option value="">All Categories</Select.Option>
                {categories.map((cat) => (
                  <Select.Option key={cat.id} value={cat.id}>
                    {cat.category_name}
                  </Select.Option>
                ))}
              </Select>
              <Button
                onClick={() => setSelectedCategory('')}
                variant="outline"
                size="sm"
              >
                Clear Filter
              </Button>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="mb-6 flex space-x-4">
          <Button
            onClick={handleCreate}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <PlusIcon />
            Add Checklist Item
          </Button>
        </div>

        {/* Items Table */}
        <Card className="p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Checklist Items</h2>
            <p className="text-sm text-gray-600 mt-1">
              Individual checklist requirements with form section numbers
            </p>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <PlusIcon />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Checklist Items</h3>
              <p className="text-lg text-gray-600 mb-6">
                Get started by creating your first checklist item
              </p>
              <Button
                onClick={handleCreate}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <PlusIcon />
                Create First Item
              </Button>
            </div>
          ) : (
            <div className="w-full overflow-hidden">
            <Table className="w-full table-auto">
              <Table.Head>
                <Table.Row>
                  <Table.Header className="w-[8%]">Form Section</Table.Header>
                  <Table.Header className="w-[12%]">Category</Table.Header>
                  <Table.Header className="w-[40%]">Checklist Detail</Table.Header>
                  <Table.Header className="w-[8%]">Sort Order</Table.Header>
                  <Table.Header className="w-[10%]">Compulsory</Table.Header>
                  <Table.Header className="w-[10%]">Status</Table.Header>
                  <Table.Header className="w-[12%]">Actions</Table.Header>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {items.map((item) => (
                  <Table.Row key={item.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <Table.Cell>
                      <span className="font-medium text-primary-600">{item.form_section}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-gray-600">{item.category_name || 'N/A'}</span>
                    </Table.Cell>
                    <Table.Cell className="break-words">
                      <span className="text-gray-900 break-words whitespace-normal">{item.checklist_detail}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-gray-600">{item.sort_order}</span>
                    </Table.Cell>
                    <Table.Cell>
                      <Switch
                        checked={item.is_compulsory || false}
                        onChange={(checked) => {
                          updateMutation.mutate({ 
                            id: item.id,
                            category_id: item.category_id || item.category?.id || '',
                            form_section: item.form_section,
                            checklist_detail: item.checklist_detail,
                            sort_order: item.sort_order,
                            is_active: item.is_active,
                            is_compulsory: checked
                          });
                        }}
                        disabled={updateMutation.isLoading}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Chip
                        variant={item.is_active ? 'success' : 'secondary'}
                        size="sm"
                      >
                        {item.is_active ? 'Active' : 'Inactive'}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(item)}
                          className="flex items-center justify-center px-3 py-1 text-xs font-medium border-0 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <EditIcon />
                          <span className="ml-1">Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(item)}
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
            </div>
          )}
        </Card>

        {/* Create Modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create Checklist Item"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.category_name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Form Section *"
              value={formData.form_section}
              onChange={(e) => setFormData({ ...formData, form_section: e.target.value })}
              placeholder="e.g., 1, 1.2, 2.2, 3.1"
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Checklist Detail *
              </label>
              <textarea
                value={formData.checklist_detail}
                onChange={(e) => setFormData({ ...formData, checklist_detail: e.target.value })}
                placeholder="Enter the checklist requirement/question"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
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
                {createMutation.isLoading ? 'Creating...' : 'Create Item'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Checklist Item"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.category_name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Form Section *"
              value={formData.form_section}
              onChange={(e) => setFormData({ ...formData, form_section: e.target.value })}
              placeholder="e.g., 1, 1.2, 2.2, 3.1"
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Checklist Detail *
              </label>
              <textarea
                value={formData.checklist_detail}
                onChange={(e) => setFormData({ ...formData, checklist_detail: e.target.value })}
                placeholder="Enter the checklist requirement/question"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
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
              <Switch
                checked={formData.is_compulsory}
                onChange={(checked) => setFormData({ ...formData, is_compulsory: checked })}
              />
              <label className="text-sm font-medium text-gray-700">
                Compulsory
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
                {updateMutation.isLoading ? 'Updating...' : 'Update Item'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Delete Modal */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Delete Checklist Item"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to delete the checklist item "{selectedItem?.checklist_detail}"?
            </p>
            <p className="text-sm text-red-600">
              This action cannot be undone.
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
                onClick={() => deleteMutation.mutate(selectedItem.id)}
                disabled={deleteMutation.isLoading}
              >
                {deleteMutation.isLoading ? 'Deleting...' : 'Delete Item'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default WelfareChecklistItems;

