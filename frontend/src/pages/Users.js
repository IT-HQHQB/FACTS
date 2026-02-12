import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button, Input, Card, Alert, Table, Select, MultiSelect, Modal, Badge, Switch } from '../components/ui';

const Users = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [jamiat, setJamiat] = useState([]);
  const [jamaat, setJamaat] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filters
  const [filters, setFilters] = useState({
    role: '',
    is_active: '',
    search: ''
  });
  
  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editForm, setEditForm] = useState({
    its_number: '',
    full_name: '',
    username: '',
    email: '',
    phone: '',
    jamiat: [],
    jamaat: [],
    role: '',
    is_active: true, // 0 = Inactive, 1 = Active
    password: '',
    confirmPassword: '',
    photo: ''
  });
  const [createForm, setCreateForm] = useState({
    its_number: '',
    full_name: '',
    username: '',
    email: '',
    phone: '',
    jamiat: [],
    jamaat: [],
    role: '',
    is_active: true, // 0 = Inactive, 1 = Active
    password: '',
    confirmPassword: '',
    photo: ''
  });
  const [editLoading, setEditLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [createError, setCreateError] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const [isFetchingFromApi, setIsFetchingFromApi] = useState(false);
  const [isEditFetchingFromApi, setIsEditFetchingFromApi] = useState(false);
  const [apiError, setApiError] = useState('');
  const [editApiError, setEditApiError] = useState('');
  const [isFullNameFromApi, setIsFullNameFromApi] = useState(false);
  const [isEditFullNameFromApi, setIsEditFullNameFromApi] = useState(false);
  
  // Excel import states
  const [excelFile, setExcelFile] = useState(null);
  const [excelImportLoading, setExcelImportLoading] = useState(false);
  const [excelImportResult, setExcelImportResult] = useState(null);
  const [excelImportError, setExcelImportError] = useState('');

  // Filtered jamaat based on selected jamiat
  const getFilteredJamaat = () => {
    if (createForm.jamiat.length === 0) {
      return jamaat; // Show all jamaat if no jamiat selected
    }
    return jamaat.filter(j => createForm.jamiat.includes(j.jamiat_id));
  };

  // Handle jamiat selection change
  const handleJamiatChange = (selectedJamiatIds) => {
    setCreateForm(prev => {
      // Keep only jamaat that belong to the newly selected jamiat
      const validJamaat = prev.jamaat.filter(jamaatId => {
        const jamaatItem = jamaat.find(j => j.id === jamaatId);
        return jamaatItem && selectedJamiatIds.includes(jamaatItem.jamiat_id);
      });
      
      return { ...prev, jamiat: selectedJamiatIds, jamaat: validJamaat };
    });
  };

  // Handle select all jamaat for selected jamiat
  const handleSelectAllJamaat = () => {
    const filteredJamaat = getFilteredJamaat();
    const allJamaatIds = filteredJamaat.map(j => j.id);
    const allSelected = allJamaatIds.every(id => createForm.jamaat.includes(id));
    
    if (allSelected) {
      // Deselect all filtered jamaat
      const newJamaat = createForm.jamaat.filter(id => !allJamaatIds.includes(id));
      setCreateForm(prev => ({ ...prev, jamaat: newJamaat }));
    } else {
      // Select all filtered jamaat
      const newJamaat = [...new Set([...createForm.jamaat, ...allJamaatIds])];
      setCreateForm(prev => ({ ...prev, jamaat: newJamaat }));
    }
  };

  // Filtered jamaat for edit form based on selected jamiat
  const getFilteredJamaatForEdit = () => {
    if (editForm.jamiat.length === 0) {
      return jamaat; // Show all jamaat if no jamiat selected
    }
    return jamaat.filter(j => editForm.jamiat.includes(j.jamiat_id));
  };

  // Handle jamiat selection change for edit form
  const handleEditJamiatChange = (selectedJamiatIds) => {
    setEditForm(prev => {
      // Keep only jamaat that belong to the newly selected jamiat
      const validJamaat = prev.jamaat.filter(jamaatId => {
        const jamaatItem = jamaat.find(j => j.id === jamaatId);
        return jamaatItem && selectedJamiatIds.includes(jamaatItem.jamiat_id);
      });
      
      return { ...prev, jamiat: selectedJamiatIds, jamaat: validJamaat };
    });
  };

  // Handle select all jamaat for selected jamiat in edit form
  const handleSelectAllJamaatForEdit = () => {
    const filteredJamaat = getFilteredJamaatForEdit();
    const allJamaatIds = filteredJamaat.map(j => j.id);
    const allSelected = allJamaatIds.every(id => editForm.jamaat.includes(id));
    
    if (allSelected) {
      // Deselect all filtered jamaat
      const newJamaat = editForm.jamaat.filter(id => !allJamaatIds.includes(id));
      setEditForm(prev => ({ ...prev, jamaat: newJamaat }));
    } else {
      // Select all filtered jamaat
      const newJamaat = [...new Set([...editForm.jamaat, ...allJamaatIds])];
      setEditForm(prev => ({ ...prev, jamaat: newJamaat }));
    }
  };

  // Fetch users with filters
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      if (filters.role) queryParams.append('role', filters.role);
      if (filters.is_active !== '') queryParams.append('is_active', filters.is_active);
      if (filters.search) queryParams.append('search', filters.search);
      
      const response = await fetch(`/api/users?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch roles
  const fetchRoles = async () => {
    try {
      const response = await fetch('/api/users/roles', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch roles');
      }
      
      const data = await response.json();
      setRoles(data.roles);
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  };

  // Fetch jamiat data
  const fetchJamiat = async () => {
    try {
      if (!token) {
        console.error('Authentication token is missing');
        return;
      }
      
      const response = await fetch('/api/jamiat', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch jamiat: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setJamiat(data.jamiat || []);
    } catch (err) {
      // Handle network errors
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        console.error('Unable to connect to the server. Please ensure the backend server is running on port 5000.');
      } else {
        console.error('Error fetching jamiat:', err);
      }
    }
  };

  // Fetch jamaat data
  const fetchJamaat = async () => {
    try {
      const response = await fetch('/api/jamaat', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch jamaat');
      }
      
      const data = await response.json();
      setJamaat(data.jamaat || []);
    } catch (err) {
      console.error('Error fetching jamaat:', err);
    }
  };

  // Fetch user statistics
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/users/stats/overview', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      
      const data = await response.json();
      setStats(data.stats);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Toggle user status
  const toggleUserStatus = async (userId) => {
    try {
      const response = await fetch(`/api/users/${userId}/toggle-status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user status');
      }
      
      setSuccess('User status updated successfully');
      fetchUsers();
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  };

  // Open delete modal
  const openDeleteModal = (user) => {
    setUserToDelete(user);
    setDeleteError('');
    setDeleteModalOpen(true);
  };

  // Close delete modal
  const closeDeleteModal = () => {
    setUserToDelete(null);
    setDeleteError('');
    setDeleteModalOpen(false);
  };

  // Delete user
  const deleteUser = async () => {
    if (!userToDelete) return;

    try {
      setDeleteLoading(true);
      setDeleteError('');
      
      const response = await fetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }
      
      setSuccess('User deleted successfully');
      closeDeleteModal();
      fetchUsers();
      fetchStats();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Download sample Excel template
  const downloadTemplate = async () => {
    try {
      const response = await axios.get('/api/users/export/template', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'blob'
      });

      // Check if response is actually an error (sometimes errors come as blobs)
      if (response.data instanceof Blob && response.data.type === 'application/json') {
        const text = await response.data.text();
        const jsonError = JSON.parse(text);
        throw new Error(jsonError.error || 'Failed to download template');
      }

      // Create download link
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'users_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      
      let errorMessage = 'Failed to download template';
      
      if (error.response) {
        if (error.response.data instanceof Blob) {
          try {
            const text = await error.response.data.text();
            const jsonError = JSON.parse(text);
            errorMessage = jsonError.error || errorMessage;
          } catch (parseError) {
            if (error.response.status === 401) {
              errorMessage = 'Authentication required. Please log in again.';
            } else if (error.response.status === 403) {
              errorMessage = 'You do not have permission to download the template.';
            } else if (error.response.status >= 500) {
              errorMessage = 'Server error. Please try again later.';
            }
          }
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setExcelImportError(errorMessage);
      setTimeout(() => setExcelImportError(''), 5000);
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const contentType = file.type;
      if (!contentType.includes('spreadsheet') && !contentType.includes('excel') && !contentType.includes('application/vnd.openxmlformats')) {
        setExcelImportError('Please select a valid Excel file (.xlsx or .xls)');
        setExcelFile(null);
        return;
      }
      setExcelFile(file);
      setExcelImportError('');
      setExcelImportResult(null);
    }
  };

  // Handle Excel import
  const handleExcelImport = async () => {
    if (!excelFile) {
      setExcelImportError('Please select an Excel file');
      return;
    }

    try {
      setExcelImportLoading(true);
      setExcelImportError('');
      setExcelImportResult(null);

      const formData = new FormData();
      formData.append('file', excelFile);

      const response = await axios.post('/api/users/import-excel', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setExcelImportResult(response.data);
      setExcelFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('excel-file-input');
      if (fileInput) {
        fileInput.value = '';
      }

      // Refresh users list
      fetchUsers();
      fetchStats();

      // Auto-dismiss success message after 5 seconds
      setTimeout(() => {
        setExcelImportResult(null);
      }, 5000);
    } catch (error) {
      console.error('Error importing Excel:', error);
      
      let errorMessage = 'Failed to import Excel file';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setExcelImportError(errorMessage);
    } finally {
      setExcelImportLoading(false);
    }
  };

  // Close edit modal and reset all states
  const closeEditModal = () => {
    setEditForm({
      its_number: '',
      full_name: '',
      username: '',
      email: '',
      phone: '',
      jamiat: [],
      jamaat: [],
      role: '',
      is_active: true,
      password: '',
      confirmPassword: '',
      photo: ''
    });
    setEditError('');
    setEditApiError('');
    setEditPhotoPreview(null);
    setIsEditFetchingFromApi(false);
    setIsEditFullNameFromApi(false);
    setSelectedUser(null);
    setEditModalOpen(false);
  };

  // Open edit modal
  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditForm({
      its_number: user.its_number || '',
      full_name: user.full_name || '',
      username: user.username || '',
      email: user.email || '',
      phone: user.phone || '',
      jamiat: user.jamiat ? user.jamiat.map(j => j.id) : [],
      jamaat: user.jamaat ? user.jamaat.map(j => j.id) : [],
      role: user.role || '',
      is_active: user.is_active === 1, // Convert 0/1 to boolean (0=inactive=false, 1=active=true)
      password: '',
      confirmPassword: '',
      photo: user.photo || ''
    });
    // Set photo preview if user has photo
    if (user.photo) {
      setEditPhotoPreview(user.photo);
    } else {
      setEditPhotoPreview(null);
    }
    setEditError('');
    setEditApiError('');
    setIsEditFetchingFromApi(false);
    setEditModalOpen(true);
  };

  // Close create modal and reset all states
  const closeCreateModal = () => {
    setCreateForm({
      its_number: '',
      full_name: '',
      username: '',
      email: '',
      phone: '',
      jamiat: [],
      jamaat: [],
      role: '',
      is_active: true, // 0 = Inactive, 1 = Active
      password: '',
      confirmPassword: '',
      photo: ''
    });
    setCreateError('');
    setApiError('');
    setPhotoPreview(null);
    setIsFetchingFromApi(false);
    setIsFullNameFromApi(false);
    setCreateModalOpen(false);
  };

  // Open create modal
  const openCreateModal = () => {
    setCreateForm({
      its_number: '',
      full_name: '',
      username: '',
      email: '',
      phone: '',
      jamiat: [],
      jamaat: [],
      role: '',
      is_active: true, // 0 = Inactive, 1 = Active
      password: '',
      confirmPassword: '',
      photo: ''
    });
    setCreateError('');
    setApiError('');
    setPhotoPreview(null);
    setIsFetchingFromApi(false);
    setIsFullNameFromApi(false);
    setCreateModalOpen(true);
  };

  // Function to fetch data from external API for create modal
  const fetchFromApiForCreate = async (itsNumber) => {
    if (!itsNumber || itsNumber.trim() === '') {
      return; // Don't fetch if ITS number is empty
    }

    setIsFetchingFromApi(true);
    setApiError('');

    try {
      const response = await axios.get(`/api/applicants/fetch-from-api/${itsNumber}`);
      const apiData = response.data.data;
      
      console.log('🔍 API Response for ITS', itsNumber, ':', apiData);
      console.log('📸 Photo data received:', apiData.photo ? `YES (${(apiData.photo.length / 1024).toFixed(2)} KB)` : 'NO');

      // Auto-fill form fields with API data
      if (apiData.full_name) {
        setCreateForm(prev => ({ ...prev, full_name: apiData.full_name }));
        setIsFullNameFromApi(true);
      }
      
      if (apiData.email) {
        setCreateForm(prev => ({ ...prev, email: apiData.email }));
      }

      if (apiData.phone) {
        setCreateForm(prev => ({ ...prev, phone: apiData.phone }));
      }

      if (apiData.photo) {
        console.log('✅ Setting photo in form and preview');
        setCreateForm(prev => ({ ...prev, photo: apiData.photo }));
        setPhotoPreview(apiData.photo);
      } else {
        console.log('⚠️ No photo data available from API');
        setCreateForm(prev => ({ ...prev, photo: '' }));
        setPhotoPreview(null);
      }

      setSuccess('Data fetched successfully from external API!');
      setCreateError('');
      
    } catch (error) {
      console.error('❌ Create API fetch error:', error);
      setApiError(error.response?.data?.error || 'Failed to fetch data from external API');
    } finally {
      setIsFetchingFromApi(false);
    }
  };

  // Handle ITS number keydown for create modal
  const handleCreateItsNumberKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const itsNumber = createForm.its_number.trim();
      if (itsNumber.length >= 3) {
        fetchFromApiForCreate(itsNumber);
      } else {
        setApiError('Please enter at least 3 characters of the ITS number');
      }
    }
  };

  // Function to fetch data from external API for edit modal
  const fetchFromApiForEdit = async (itsNumber) => {
    if (!itsNumber || itsNumber.trim() === '') {
      return; // Don't fetch if ITS number is empty
    }

    setIsEditFetchingFromApi(true);
    setEditApiError('');

    try {
      const response = await axios.get(`/api/applicants/fetch-from-api/${itsNumber}`);
      const apiData = response.data.data;
      
      console.log('🔍 EDIT - API Response for ITS', itsNumber, ':', apiData);
      console.log('📸 EDIT - Photo data received:', apiData.photo ? `YES (${(apiData.photo.length / 1024).toFixed(2)} KB)` : 'NO');

      // Auto-fill form fields with API data
      if (apiData.full_name) {
        setEditForm(prev => ({ ...prev, full_name: apiData.full_name }));
        setIsEditFullNameFromApi(true);
      }
      
      if (apiData.email) {
        setEditForm(prev => ({ ...prev, email: apiData.email }));
      }

      if (apiData.phone) {
        setEditForm(prev => ({ ...prev, phone: apiData.phone }));
      }

      if (apiData.photo) {
        console.log('✅ EDIT - Setting photo in form and preview');
        setEditForm(prev => ({ ...prev, photo: apiData.photo }));
        setEditPhotoPreview(apiData.photo);
      } else {
        console.log('⚠️ EDIT - No photo data available from API');
        setEditForm(prev => ({ ...prev, photo: '' }));
        setEditPhotoPreview(null);
      }

      setSuccess('Data fetched successfully from external API!');
      setEditError('');
      
    } catch (error) {
      console.error('❌ Edit API fetch error:', error);
      setEditApiError(error.response?.data?.error || 'Failed to fetch data from external API');
    } finally {
      setIsEditFetchingFromApi(false);
    }
  };

  // Handle ITS number keydown for edit modal
  const handleEditItsNumberKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const itsNumber = editForm.its_number.trim();
      if (itsNumber.length >= 3) {
        fetchFromApiForEdit(itsNumber);
      } else {
        setEditApiError('Please enter at least 3 characters of the ITS number');
      }
    }
  };

  // Create user
  const createUser = async () => {
    try {
      setCreateLoading(true);
      setCreateError('');
      
      // Validate passwords if provided
      if (createForm.password && createForm.password !== createForm.confirmPassword) {
        throw new Error('Passwords do not match');
      }
      
      const userData = {
        full_name: createForm.full_name,
        username: createForm.username,
        email: createForm.email,
        phone: createForm.phone,
        its_number: createForm.its_number || undefined,
        jamiat: createForm.jamiat,
        jamaat: createForm.jamaat,
        role: createForm.role,
        is_active: createForm.is_active ? 1 : 0, // Convert boolean to 0/1 (0=inactive, 1=active)
        password: createForm.password || undefined,
        photo: createForm.photo || undefined
      };
      
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create user');
      }
      
      setSuccess('User created successfully');
      closeCreateModal();
      fetchUsers();
      fetchStats();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // Update user
  const updateUser = async () => {
    try {
      setEditLoading(true);
      setEditError('');
      
      // Validate passwords if provided
      if (editForm.password && editForm.password !== editForm.confirmPassword) {
        throw new Error('Passwords do not match');
      }
      
      const userData = {
        full_name: editForm.full_name,
        username: editForm.username,
        email: editForm.email,
        phone: editForm.phone,
        its_number: editForm.its_number || undefined,
        jamiat: editForm.jamiat,
        jamaat: editForm.jamaat,
        role: editForm.role,
        is_active: editForm.is_active ? 1 : 0, // Convert boolean to 0/1 (0=inactive, 1=active)
        password: editForm.password || undefined,
        photo: editForm.photo || undefined
      };
      
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }
      
      setSuccess('User updated successfully');
      closeEditModal();
      fetchUsers();
      fetchStats();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      role: '',
      is_active: '',
      search: ''
    });
  };

  // Format role name
  const formatRoleName = (role) => {
    return role.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchJamiat();
    fetchJamaat();
    fetchStats();
  }, [filters]);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Users</h1>
        <p className="text-gray-600">Manage user accounts and permissions</p>
      </div>
      
      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Users</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total_users || 0}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active Users</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.active_users || 0}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Inactive Users</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.inactive_users || 0}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Admins</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.admin_count || 0}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Input
                label="Search Users"
                placeholder="Search by full name, username, or email..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>
            
            <div>
              <Select
                label="Role"
                value={filters.role}
                onChange={(e) => handleFilterChange('role', e.target.value)}
              >
                <Select.Option value="">All Roles</Select.Option>
                {roles.map(role => (
                  <Select.Option key={role.name} value={role.name}>
                    {formatRoleName(role.name)}
                  </Select.Option>
                ))}
              </Select>
            </div>
            
            <div>
              <Select
                label="Status"
                value={filters.is_active}
                onChange={(e) => handleFilterChange('is_active', e.target.value)}
              >
                <Select.Option value="">All Status</Select.Option>
                <Select.Option value="true">Active</Select.Option>
                <Select.Option value="false">Inactive</Select.Option>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">Users List</h3>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                {users.length} user{users.length !== 1 ? 's' : ''} found
              </div>
              <Button
                variant="outline"
                onClick={downloadTemplate}
                className="flex items-center space-x-2"
                disabled={excelImportLoading}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download Sample Excel</span>
              </Button>
              <div className="flex items-center space-x-2">
                <input
                  id="excel-file-input"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={excelImportLoading}
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('excel-file-input')?.click()}
                  disabled={excelImportLoading}
                  className="flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Select File</span>
                </Button>
                <Button
                  variant="primary"
                  onClick={handleExcelImport}
                  disabled={excelImportLoading || !excelFile}
                  loading={excelImportLoading}
                  className="flex items-center space-x-2"
                >
                  {excelImportLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>Import from Excel</span>
                    </>
                  )}
                </Button>
              </div>
              <Button
                variant="primary"
                onClick={openCreateModal}
                className="flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create User</span>
              </Button>
            </div>
          </div>

          {/* Excel Import Results */}
          {excelImportError && (
            <Alert severity="error" onClose={() => setExcelImportError('')} className="mb-4">
              {excelImportError}
            </Alert>
          )}
          {excelImportResult && (
            <Alert 
              severity="success" 
              onClose={() => setExcelImportResult(null)} 
              className="mb-4"
            >
              <div>
                <strong>Import Complete:</strong> {excelImportResult.inserted} inserted, {excelImportResult.updated} updated, {excelImportResult.skipped} skipped
                {excelImportResult.errors && excelImportResult.errors.length > 0 && (
                  <div className="mt-2">
                    <strong>{excelImportResult.errors.length} error(s) occurred:</strong>
                    <ul className="list-disc list-inside mt-1 text-sm">
                      {excelImportResult.errors.slice(0, 10).map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                      {excelImportResult.errors.length > 10 && (
                        <li>... and {excelImportResult.errors.length - 10} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </Alert>
          )}
          {excelFile && (
            <Alert severity="info" className="mb-4">
              Selected file: {excelFile.name}
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-2 text-gray-600">Loading users...</span>
            </div>
          ) : (
            <Table>
              <Table.Head>
                <Table.Row>
                  <Table.Header>Photo</Table.Header>
                  <Table.Header>User</Table.Header>
                  <Table.Header>Role</Table.Header>
                  <Table.Header>Status</Table.Header>
                  <Table.Header>Created</Table.Header>
                  <Table.Header align="center">Actions</Table.Header>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {users.map((user) => (
                  <Table.Row key={user.id} hover>
                    <Table.Cell>
                      <div className="flex items-center justify-center">
                        {user.photo && (
                          <img 
                            src={user.photo}
                            alt={user.full_name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                          />
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.full_name}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        <div className="text-xs text-gray-400">@{user.username}</div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={(user.role === 'admin' || user.role === 'super_admin') ? 'primary' : 'secondary'}>
                        {formatRoleName(user.role)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center">
                        <Switch
                          checked={user.is_active === 1} // 0 = Inactive, 1 = Active
                          onChange={() => toggleUserStatus(user.id)}
                          disabled={user.id === JSON.parse(localStorage.getItem('user'))?.id}
                        />
                        <span className={`ml-2 text-sm ${user.is_active === 1 ? 'text-green-600' : 'text-red-600'}`}>
                          {user.is_active === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="text-sm text-gray-900">
                        {formatDate(user.created_at)}
                      </div>
                    </Table.Cell>
                    <Table.Cell align="center">
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(user)}
                        >
                          Edit
                        </Button>
                        {user.role !== 'super_admin' && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => openDeleteModal(user)}
                            disabled={user.id === JSON.parse(localStorage.getItem('user'))?.id}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}

          {users.length === 0 && !loading && (
        <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
              <p className="text-gray-500">Try adjusting your filters or search terms.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Edit User Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={closeEditModal}
        title="Edit User"
        size="md"
      >
        <div className="space-y-4">
          {editError && (
            <Alert severity="error">
              {editError}
            </Alert>
          )}
          {editApiError && (
            <Alert severity="error">
              {editApiError}
            </Alert>
          )}
          
          <div>
            <Input
              label="ITS Number"
              value={editForm.its_number}
              onChange={(e) => {
                const itsNumber = e.target.value;
                setEditForm(prev => ({ ...prev, its_number: itsNumber }));
                // Auto-fetch when 3+ characters are entered
                if (itsNumber.length >= 3 && itsNumber.length <= 8) {
                  fetchFromApiForEdit(itsNumber);
                } else if (itsNumber.length === 0) {
                  // Reset form if ITS is cleared - restore original user data
                  if (selectedUser) {
                    setEditForm(prev => ({ 
                      ...prev, 
                      full_name: selectedUser.full_name || '', 
                      photo: selectedUser.photo || '' 
                    }));
                    setEditPhotoPreview(selectedUser.photo || null);
                    setIsEditFullNameFromApi(false);
                  }
                  setEditApiError('');
                }
              }}
              onKeyDown={handleEditItsNumberKeyDown}
              placeholder="Enter 8-digit ITS number"
              maxLength={8}
            />
            <p className="text-xs text-gray-500 mt-1">Data will be automatically fetched as you type (minimum 3 characters) or press Enter</p>
            {isEditFetchingFromApi && (
              <div className="text-sm text-blue-600 flex items-center mt-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Fetching data from API...
              </div>
            )}
          </div>
          
          <Input
            label="Full Name"
            value={editForm.full_name}
            onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
            required
            placeholder="Enter full name"
            readOnly={isEditFullNameFromApi}
            className={isEditFullNameFromApi ? 'bg-gray-100' : ''}
          />
          
          <Input
            label="Username"
            value={editForm.username}
            onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
            required
            placeholder="Enter username"
          />
          
          <Input
            label="Email"
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
            required
          />
          
          <Input
            label="Phone"
            type="tel"
            value={editForm.phone}
            onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="+91 9876543210"
          />
          
          <MultiSelect
            label="Jamiat"
            options={jamiat.map(j => ({ value: j.id, label: j.name }))}
            value={editForm.jamiat}
            onChange={handleEditJamiatChange}
            placeholder="Select Jamiat..."
          />
          
          <MultiSelect
            label="Jamaat"
            options={getFilteredJamaatForEdit().map(j => ({ value: j.id, label: j.name }))}
            value={editForm.jamaat}
            onChange={(value) => setEditForm(prev => ({ ...prev, jamaat: value }))}
            placeholder="Select Jamaat..."
            showSelectAll={editForm.jamiat.length > 0}
            selectAllLabel="Select All"
            onSelectAll={handleSelectAllJamaatForEdit}
          />
          
          <Select
            label="Role"
            value={editForm.role}
            onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
            required
          >
            <Select.Option value="">Select a role</Select.Option>
            {roles.map(role => (
              <Select.Option key={role.name} value={role.name}>
                {formatRoleName(role.name)}
              </Select.Option>
            ))}
          </Select>
          
          <div className="space-y-4">
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Change Password (Optional)</h4>
              <div className="space-y-3">
                <Input
                  label="New Password"
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Leave empty to keep current password"
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={editForm.confirmPassword}
                  onChange={(e) => setEditForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
          </div>

          {/* Photo Preview (from API or existing) */}
          {editPhotoPreview && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Photo {selectedUser?.photo && !editForm.its_number ? '(Current)' : '(from API)'}
              </label>
              <img 
                src={editPhotoPreview} 
                alt="User" 
                className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
              />
            </div>
          )}
          
          <div className="flex items-center space-x-3">
            <Switch
              checked={editForm.is_active}
              onChange={(checked) => setEditForm(prev => ({ ...prev, is_active: checked }))}
            />
            <span className="text-sm text-gray-700">Active User (0=Inactive, 1=Active)</span>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <Button
            variant="outline"
            onClick={closeEditModal}
            disabled={editLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={updateUser}
            loading={editLoading}
          >
            Update User
          </Button>
        </div>
      </Modal>

      {/* Create User Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={closeCreateModal}
        title="Create New User"
        size="lg"
      >
        <div className="space-y-4">
          {createError && (
            <Alert severity="error">
              {createError}
            </Alert>
          )}
          {apiError && (
            <Alert severity="error">
              {apiError}
            </Alert>
          )}
          
          <div>
            <Input
              label="ITS Number"
              value={createForm.its_number}
              onChange={(e) => {
                const itsNumber = e.target.value;
                setCreateForm(prev => ({ ...prev, its_number: itsNumber }));
                // Auto-fetch when 3+ characters are entered
                if (itsNumber.length >= 3 && itsNumber.length <= 8) {
                  fetchFromApiForCreate(itsNumber);
                } else if (itsNumber.length === 0) {
                  // Reset form if ITS is cleared
                  setCreateForm(prev => ({ ...prev, full_name: '', photo: '' }));
                  setPhotoPreview(null);
                  setApiError('');
                  setIsFullNameFromApi(false);
                }
              }}
              onKeyDown={handleCreateItsNumberKeyDown}
              placeholder="Enter 8-digit ITS number"
              maxLength={8}
            />
            <p className="text-xs text-gray-500 mt-1">Data will be automatically fetched as you type (minimum 3 characters) or press Enter</p>
            {isFetchingFromApi && (
              <div className="text-sm text-blue-600 flex items-center mt-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Fetching data from API...
              </div>
            )}
          </div>
          
          <Input
            label="Full Name"
            value={createForm.full_name}
            onChange={(e) => setCreateForm(prev => ({ ...prev, full_name: e.target.value }))}
            required
            placeholder="Enter full name"
            readOnly={isFullNameFromApi}
            className={isFullNameFromApi ? 'bg-gray-100' : ''}
          />
          
          <Input
            label="Username"
            value={createForm.username}
            onChange={(e) => setCreateForm(prev => ({ ...prev, username: e.target.value }))}
            required
            placeholder="Enter username"
          />
          
          <Input
            label="Email"
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
            required
          />
          
          <Input
            label="Phone"
            type="tel"
            value={createForm.phone}
            onChange={(e) => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="+91 9876543210"
          />
          
          <MultiSelect
            label="Jamiat"
            options={jamiat.map(j => ({ value: j.id, label: j.name }))}
            value={createForm.jamiat}
            onChange={handleJamiatChange}
            placeholder="Select Jamiat..."
          />
          
          <MultiSelect
            label="Jamaat"
            options={getFilteredJamaat().map(j => ({ value: j.id, label: j.name }))}
            value={createForm.jamaat}
            onChange={(value) => setCreateForm(prev => ({ ...prev, jamaat: value }))}
            placeholder="Select Jamaat..."
            showSelectAll={createForm.jamiat.length > 0}
            selectAllLabel="Select All"
            onSelectAll={handleSelectAllJamaat}
          />
          
          <Select
            label="Role"
            value={createForm.role}
            onChange={(e) => setCreateForm(prev => ({ ...prev, role: e.target.value }))}
            required
          >
            <Select.Option value="">Select a role</Select.Option>
            {roles.map(role => (
              <Select.Option key={role.name} value={role.name}>
                {formatRoleName(role.name)}
              </Select.Option>
            ))}
          </Select>
          
          <div className="space-y-4">
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Password Settings</h4>
              <div className="space-y-3">
                <Input
                  label="Password"
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Leave empty for auto-generated password"
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  value={createForm.confirmPassword}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm password"
                />
              </div>
            </div>
          </div>

          {/* Photo Preview (from API) */}
          {photoPreview && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Photo (from API)
              </label>
              <img 
                src={photoPreview} 
                alt="User" 
                className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
              />
            </div>
          )}
          
          <div className="flex items-center space-x-3">
            <Switch
              checked={createForm.is_active}
              onChange={(checked) => setCreateForm(prev => ({ ...prev, is_active: checked }))}
            />
            <span className="text-sm text-gray-700">Active User (0=Inactive, 1=Active)</span>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <Button
            variant="outline"
            onClick={closeCreateModal}
            disabled={createLoading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={createUser}
            loading={createLoading}
          >
            Create User
          </Button>
      </div>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        title="Delete User"
        size="sm"
      >
        <div className="space-y-4">
          {deleteError && (
            <Alert severity="error">
              {deleteError}
            </Alert>
          )}
          
          <p className="text-gray-700">
            Are you sure you want to delete <strong>{userToDelete?.full_name}</strong>? This action cannot be undone.
          </p>
          
          {userToDelete && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Email:</strong> {userToDelete.email}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Username:</strong> @{userToDelete.username}
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <Button
            variant="outline"
            onClick={closeDeleteModal}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={deleteUser}
            loading={deleteLoading}
            disabled={deleteLoading}
          >
            {deleteLoading ? 'Deleting...' : 'Delete User'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default Users;