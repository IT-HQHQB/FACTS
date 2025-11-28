import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { 
  Button, 
  Card, 
  Table, 
  Alert,
  Badge,
  Input,
  Modal,
  Select
} from '../components/ui';

const Applicants = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredApplicants, setFilteredApplicants] = useState([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [selectedJamiatId, setSelectedJamiatId] = useState('');
  const [createApiError, setCreateApiError] = useState('');
  const [isCreateFetchingFromApi, setIsCreateFetchingFromApi] = useState(false);
  const [pendingJamaatId, setPendingJamaatId] = useState(null);
  const [createApiJamiatId, setCreateApiJamiatId] = useState(null);
  const [createApiJamaatId, setCreateApiJamaatId] = useState(null);
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingApplicant, setEditingApplicant] = useState(null);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editSelectedJamiatId, setEditSelectedJamiatId] = useState('');
  const [editApiError, setEditApiError] = useState('');
  const [isEditFetchingFromApi, setIsEditFetchingFromApi] = useState(false);
  const [editPendingJamaatId, setEditPendingJamaatId] = useState(null);
  const [editApiJamiatId, setEditApiJamiatId] = useState(null);
  const [editApiJamaatId, setEditApiJamaatId] = useState(null);
  
  // Photo preview state (from API)
  const [createPhotoPreview, setCreatePhotoPreview] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  
  // Delete confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [applicantToDelete, setApplicantToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue, trigger } = useForm();
  const { register: registerEdit, handleSubmit: handleEditSubmit, formState: { errors: editErrors }, reset: resetEdit, watch: watchEdit, setValue: setEditValue } = useForm();
  
  // Watch for ITS number changes in create modal
  const watchedCreateItsNumber = watch('its_number');
  const [previousCreateItsNumber, setPreviousCreateItsNumber] = useState('');
  
  // Watch for ITS number changes in edit modal
  const watchedEditItsNumber = watchEdit('its_number');
  const [previousEditItsNumber, setPreviousEditItsNumber] = useState('');

  // Effect to handle ITS number changes in create modal
  useEffect(() => {
    if (watchedCreateItsNumber && watchedCreateItsNumber !== previousCreateItsNumber && watchedCreateItsNumber.length >= 3) {
      // Add a small delay to avoid too frequent API calls
      const timer = setTimeout(() => {
        fetchFromApiForCreate(watchedCreateItsNumber);
      }, 500);
      
      setPreviousCreateItsNumber(watchedCreateItsNumber);
      
      return () => clearTimeout(timer);
    }
  }, [watchedCreateItsNumber, previousCreateItsNumber]);

  // Effect to handle ITS number changes in edit modal
  useEffect(() => {
    if (watchedEditItsNumber && watchedEditItsNumber !== previousEditItsNumber && watchedEditItsNumber.length >= 3) {
      // Add a small delay to avoid too frequent API calls
      const timer = setTimeout(() => {
        fetchFromApiForEdit(watchedEditItsNumber);
      }, 500);
      
      setPreviousEditItsNumber(watchedEditItsNumber);
      
      return () => clearTimeout(timer);
    }
  }, [watchedEditItsNumber, previousEditItsNumber]);

  // Handle Enter key press on ITS number field for create modal
  const handleCreateItsNumberKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const itsNumber = e.target.value.trim();
      if (itsNumber && itsNumber.length >= 3) {
        fetchFromApiForCreate(itsNumber);
      } else {
        setCreateApiError('Please enter a valid ITS number (minimum 3 characters)');
      }
    }
  };

  // Handle Enter key press on ITS number field for edit modal
  const handleEditItsNumberKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const itsNumber = e.target.value.trim();
      if (itsNumber && itsNumber.length >= 3) {
        fetchFromApiForEdit(itsNumber);
      } else {
        setEditApiError('Please enter a valid ITS number (minimum 3 characters)');
      }
    }
  };

  // Fetch applicants
  const { data: applicantsData, isLoading, error, refetch } = useQuery(
    'applicants',
    () => axios.get('/api/applicants').then(res => res.data),
    {
      select: (data) => data.applicants || [],
    }
  );

  // Fetch jamiat data
  const { data: jamiatData } = useQuery(
    'jamiat',
    () => axios.get('/api/jamiat').then(res => res.data),
    {
      select: (data) => {
        const jamiatOptions = data.jamiat || [];
        return jamiatOptions;
      },
    }
  );

  // Reset jamaat_id when jamiat_id changes
  useEffect(() => {
    if (selectedJamiatId) {
      setValue('jamaat_id', '');
    }
  }, [selectedJamiatId, setValue]);

  // Reset jamaat_id when edit jamiat_id changes (but not when initially setting it)
  useEffect(() => {
    if (editSelectedJamiatId && editingApplicant) {
      // Only reset if the jamiat_id is different from the current applicant's jamiat_id
      if (editSelectedJamiatId !== editingApplicant.jamiat_id) {
        setEditValue('jamaat_id', '');
      }
    }
  }, [editSelectedJamiatId, setEditValue, editingApplicant]);

  // Fetch jamaat data based on selected jamiat
  const { data: jamaatData, isLoading: jamaatLoading, error: jamaatError } = useQuery(
    ['jamaat', selectedJamiatId],
    () => {
      return axios.get('/api/jamaat', { 
        params: selectedJamiatId ? { jamiat_id: selectedJamiatId } : {} 
      }).then(res => {
        return res.data;
      });
    },
    {
      select: (data) => {
        const jamaatOptions = data.jamaat || [];
        return jamaatOptions;
      },
      enabled: !!selectedJamiatId, // Only fetch when jamiat is selected
    }
  );

  // Fetch jamaat data for edit form based on selected jamiat
  const { data: editJamaatData, isLoading: editJamaatLoading, error: editJamaatError } = useQuery(
    ['jamaat', editSelectedJamiatId],
    () => axios.get('/api/jamaat', { 
      params: editSelectedJamiatId ? { jamiat_id: editSelectedJamiatId } : {} 
    }).then(res => res.data),
    {
      select: (data) => data.jamaat || [],
      enabled: !!editSelectedJamiatId, // Only fetch when jamiat is selected
    }
  );

  // Fetch case types
  const { data: caseTypesData } = useQuery(
    'caseTypes',
    () => axios.get('/api/case-types').then(res => res.data),
    {
      select: (data) => data.caseTypes || [],
    }
  );

  // Set jamaat_id when editJamaatData is loaded and we have an editing applicant
  useEffect(() => {
    if (editJamaatData && editingApplicant && editingApplicant.jamaat_id) {
      // Check if the jamaat_id exists in the loaded data
      const jamaatExists = editJamaatData.some(jamaat => jamaat.id === editingApplicant.jamaat_id);
      if (jamaatExists) {
        setEditValue('jamaat_id', editingApplicant.jamaat_id);
      }
    }
  }, [editJamaatData, editingApplicant, setEditValue]);

  // Set jamaat_id when jamaatData is loaded and we have a pending jamaat_id from API
  useEffect(() => {
    if (jamaatData && pendingJamaatId) {
      setValue('jamaat_id', pendingJamaatId);
      setPendingJamaatId(null);
    }
  }, [jamaatData, pendingJamaatId, setValue]);

  // Set jamaat_id when editJamaatData is loaded and we have a pending jamaat_id from API
  useEffect(() => {
    if (editJamaatData && editPendingJamaatId) {
      setEditValue('jamaat_id', editPendingJamaatId);
      setEditPendingJamaatId(null);
    }
  }, [editJamaatData, editPendingJamaatId, setEditValue]);

  const createApplicantMutation = useMutation(
    (applicantData) => axios.post('/api/applicants', applicantData),
    {
      onError: (error) => {
        setCreateError(error.response?.data?.message || 'Failed to create applicant');
        setCreateSuccess('');
      },
    }
  );

  const createCaseMutation = useMutation(
    (caseData) => axios.post('/api/cases', caseData),
    {
      onSuccess: (response) => {
        setCreateSuccess('Applicant and case created successfully!');
        setCreateError('');
        reset();
        setCreatePhotoPreview(null);
        setCreateModalOpen(false);
        refetch(); // Refresh the applicants list
        // Navigate to the case detail page
        const caseId = response.data.caseId;
        if (caseId) {
          setTimeout(() => {
            navigate(`/cases/${caseId}`);
          }, 1500);
        }
      },
      onError: (error) => {
        setCreateError(error.response?.data?.error || error.response?.data?.message || 'Failed to create case');
        setCreateSuccess('');
      },
    }
  );

  const updateApplicantMutation = useMutation(
    ({ applicantId, applicantData }) => axios.put(`/api/applicants/${applicantId}`, applicantData),
    {
      onSuccess: (response) => {
        setEditSuccess('Applicant updated successfully!');
        setEditError('');
        resetEdit();
        setEditModalOpen(false);
        setEditingApplicant(null);
        refetch(); // Refresh the applicants list
      },
      onError: (error) => {
        setEditError(error.response?.data?.message || 'Failed to update applicant');
        setEditSuccess('');
      },
    }
  );

  const deleteApplicantMutation = useMutation(
    (applicantId) => axios.delete(`/api/applicants/${applicantId}`),
    {
      onSuccess: () => {
        setDeleteModalOpen(false);
        setApplicantToDelete(null);
        setDeleteError('');
        refetch(); // Refresh the applicants list
      },
      onError: (error) => {
        setDeleteError(error.response?.data?.error || 'Failed to delete applicant');
      },
    }
  );

  // Filter applicants based on search term
  useEffect(() => {
    if (applicantsData) {
      const filtered = applicantsData.filter(applicant => 
        applicant.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        applicant.its_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        applicant.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredApplicants(filtered);
    }
  }, [applicantsData, searchTerm]);

  const handleCreateApplicant = () => {
    setCreateModalOpen(true);
  };

  // Function to fetch data from external API for create modal
  const fetchFromApiForCreate = async (itsNumber) => {
    if (!itsNumber || itsNumber.trim() === '') {
      return; // Don't fetch if ITS number is empty
    }

    setIsCreateFetchingFromApi(true);
    setCreateApiError('');

    try {
      const response = await axios.get(`/api/applicants/fetch-from-api/${itsNumber}`);
      const apiData = response.data.data;
      
      console.log('🔍 API Response for ITS', itsNumber, ':', apiData);
      console.log('📸 Photo data received:', apiData.photo ? `YES (${(apiData.photo.length / 1024).toFixed(2)} KB)` : 'NO');

      // Auto-fill form fields with API data
      if (apiData.full_name) {
        setValue('full_name', apiData.full_name);
      }
      
      if (apiData.age) {
        setValue('age', apiData.age);
      }
      if (apiData.gender) {
        setValue('gender', apiData.gender);
      }
      if (apiData.phone) {
        setValue('phone', apiData.phone);
      }
      if (apiData.email) {
        setValue('email', apiData.email);
      }
      if (apiData.photo) {
        console.log('✅ Setting photo in form and preview');
        setValue('photo', apiData.photo);
        setCreatePhotoPreview(apiData.photo);
      } else {
        console.log('⚠️ No photo data available from API');
        setValue('photo', null);
        setCreatePhotoPreview(null);
      }
      if (apiData.address) {
        setValue('address', apiData.address);
      }
      
      // Set jamiat and jamaat names and IDs from API data
      if (apiData.jamiat_name) {
        setValue('jamiat_name', apiData.jamiat_name);
      }
      if (apiData.jamaat_name) {
        setValue('jamaat_name', apiData.jamaat_name);
      }
      
      // Store the IDs for submission
      if (apiData.jamiat_id) {
        setCreateApiJamiatId(apiData.jamiat_id);
      }
      if (apiData.jamaat_id) {
        setCreateApiJamaatId(apiData.jamaat_id);
      }

      setCreateSuccess('Data fetched successfully from external API!');
      setCreateError('');
      
    } catch (error) {
      console.error('❌ Create API fetch error:', error);
      setCreateApiError(error.response?.data?.error || 'Failed to fetch data from external API');
    } finally {
      setIsCreateFetchingFromApi(false);
    }
  };

  const handleEditApplicant = (applicant) => {
    setEditingApplicant(applicant);
    setEditSelectedJamiatId(applicant.jamiat_id || '');
    setEditError('');
    setEditSuccess('');
    setEditApiError('');
    
    // Populate the edit form with existing data
    resetEdit({
      its_number: applicant.its_number,
      full_name: applicant.full_name,
      age: applicant.age,
      gender: applicant.gender,
      phone: applicant.phone || '',
      email: applicant.email,
      photo: applicant.photo || '',
      address: applicant.address,
      jamiat_name: applicant.jamiat_name || '',
      jamaat_name: applicant.jamaat_name || ''
    });
    
    // Set photo preview if photo exists
    if (applicant.photo) {
      setEditPhotoPreview(applicant.photo);
    } else {
      setEditPhotoPreview(null);
    }
    
    setEditModalOpen(true);
  };

  const handleDeleteApplicant = (applicant) => {
    setApplicantToDelete(applicant);
    setDeleteError('');
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (applicantToDelete) {
      deleteApplicantMutation.mutate(applicantToDelete.id);
    }
  };

  const handleCancelDelete = () => {
    setDeleteModalOpen(false);
    setApplicantToDelete(null);
    setDeleteError('');
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
        setEditValue('full_name', apiData.full_name);
      }
      
      if (apiData.age) setEditValue('age', apiData.age);
      if (apiData.gender) setEditValue('gender', apiData.gender);
      if (apiData.phone) {
        setEditValue('phone', apiData.phone);
      }
      if (apiData.email) setEditValue('email', apiData.email);
      if (apiData.photo) {
        console.log('✅ EDIT - Setting photo in form and preview');
        setEditValue('photo', apiData.photo);
        setEditPhotoPreview(apiData.photo);
      } else {
        console.log('⚠️ EDIT - No photo data available from API');
        setEditValue('photo', null);
        setEditPhotoPreview(null);
      }
      if (apiData.address) setEditValue('address', apiData.address);
      
      // Set jamiat and jamaat names and IDs from API data
      if (apiData.jamiat_name) {
        setEditValue('jamiat_name', apiData.jamiat_name);
      }
      if (apiData.jamaat_name) {
        setEditValue('jamaat_name', apiData.jamaat_name);
      }
      
      // Store the IDs for submission
      if (apiData.jamiat_id) {
        setEditApiJamiatId(apiData.jamiat_id);
      }
      if (apiData.jamaat_id) {
        setEditApiJamaatId(apiData.jamaat_id);
      }

      setEditSuccess('Data fetched successfully from external API!');
      setEditError('');
      
    } catch (error) {
      console.error('❌ EDIT - API fetch error:', error);
      setEditApiError(error.response?.data?.error || 'Failed to fetch data from external API');
    } finally {
      setIsEditFetchingFromApi(false);
    }
  };

  const onSubmit = async (data) => {
    // Prevent double submission
    if (createApplicantMutation.isLoading || createCaseMutation.isLoading) {
      return;
    }

    setCreateError('');
    setCreateSuccess('');
    
    try {
      // Split full name into first and last name
      const nameParts = data.full_name?.trim().split(' ') || [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const applicantData = {
        its_number: data.its_number,
        first_name: firstName,
        last_name: lastName,
        age: data.age,
        gender: data.gender,
        phone: data.phone,
        email: data.email,
        photo: data.photo || null,
        address: data.address,
        jamiat_name: data.jamiat_name,
        jamaat_name: data.jamaat_name,
        jamiat_id: createApiJamiatId,
        jamaat_id: createApiJamaatId
      };
      
      console.log('💾 Creating applicant with data:', {
        ...applicantData,
        photo: applicantData.photo ? `Photo included (${(applicantData.photo.length / 1024).toFixed(2)} KB)` : 'NO PHOTO'
      });
      
      // Create applicant first using direct axios call to avoid mutation side effects
      const applicantResponse = await axios.post('/api/applicants', applicantData);
      const applicantId = applicantResponse.data.applicantId;
      
      if (!applicantId) {
        throw new Error('Failed to get applicant ID from response');
      }
      
      console.log('✅ Applicant created successfully with ID:', applicantId);
      
      // Create case with the newly created applicant
      const caseData = {
        applicant_id: applicantId,
        case_type_id: data.case_type_id,
        roles: null,
        assigned_counselor_id: null,
        jamiat_id: createApiJamiatId || null,
        jamaat_id: createApiJamaatId || null,
        assigned_role: null,
        description: data.description,
        notes: data.notes || null
      };
      
      console.log('💾 Creating case with data:', caseData);
      
      // Create case - let the mutation's onSuccess handle cleanup
      await createCaseMutation.mutateAsync(caseData);
      
      console.log('✅ Case created successfully');
    } catch (error) {
      console.error('❌ Failed to create applicant or case:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error details:', error.response?.data?.details || error.response?.data?.error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to create applicant or case';
      setCreateError(errorMessage);
      setCreateSuccess('');
    }
  };

  const onEditSubmit = async (data) => {
    setEditError('');
    setEditSuccess('');
    
    try {
      // Split full name into first and last name
      const nameParts = data.full_name?.trim().split(' ') || [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const applicantData = {
        its_number: data.its_number,
        first_name: firstName,
        last_name: lastName,
        age: data.age,
        gender: data.gender,
        phone: data.phone,
        email: data.email,
        photo: data.photo || null,
        address: data.address,
        jamiat_name: data.jamiat_name,
        jamaat_name: data.jamaat_name,
        jamiat_id: editApiJamiatId,
        jamaat_id: editApiJamaatId
      };
      
      // Update applicant
      await axios.put(`/api/applicants/${editingApplicant.id}`, applicantData);
      
      setEditSuccess('Applicant updated successfully!');
      resetEdit();
      setEditPhotoPreview(null);
      setEditModalOpen(false);
      setEditingApplicant(null);
      refetch(); // Refresh the applicants list
    } catch (error) {
      setEditError(error.response?.data?.error || 'Failed to update applicant');
      setEditSuccess('');
    }
  };

  const handleCreateModalClose = () => {
    setCreateModalOpen(false);
    setCreateError('');
    setCreateSuccess('');
    setCreateApiError('');
    setSelectedJamiatId('');
    setCreatePhotoPreview(null);
    reset();
  };

  const handleEditModalClose = () => {
    setEditModalOpen(false);
    setEditError('');
    setEditSuccess('');
    setEditSelectedJamiatId('');
    setEditingApplicant(null);
    setEditPhotoPreview(null);
    resetEdit();
  };



  const columns = [
    {
      key: 'photo',
      label: 'Photo',
      render: (applicant) => (
        <div className="flex items-center justify-center">
          {applicant.photo && (
            <img 
              src={applicant.photo}
              alt={applicant.full_name}
              className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
            />
          )}
        </div>
      )
    },
    {
      key: 'its_number',
      label: 'ITS Number',
      render: (applicant) => (
        <span className="font-medium text-gray-900">{applicant.its_number}</span>
      )
    },
    {
      key: 'name',
      label: 'Name',
      render: (applicant) => (
        <div>
          <div className="font-medium text-gray-900">
            {applicant.full_name}
          </div>
          <div className="text-sm text-gray-500">{applicant.email}</div>
        </div>
      )
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (applicant) => (
        <div>
          <div className="text-sm text-gray-900">{applicant.phone || 'N/A'}</div>
          <div className="text-sm text-gray-500">{applicant.email || 'N/A'}</div>
        </div>
      )
    },
    {
      key: 'jamiat',
      label: 'Jamiat',
      render: (applicant) => (
        <span className="text-sm text-gray-900">{applicant.jamiat_name || 'N/A'}</span>
      )
    },
    {
      key: 'jamaat',
      label: 'Jamaat',
      render: (applicant) => (
        <span className="text-sm text-gray-900">{applicant.jamaat_name || 'N/A'}</span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (applicant) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleEditApplicant(applicant)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDeleteApplicant(applicant)}
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
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading applicants...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert severity="error">
          Failed to load applicants. Please try again.
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Applicants</h1>
            <p className="text-gray-600">Manage applicant information</p>
          </div>
          <Button onClick={handleCreateApplicant}>
            Case Registration
          </Button>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Input
                placeholder="Search applicants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            {filteredApplicants.length} of {applicantsData?.length || 0} applicants
          </div>
        </div>
      </div>

      {/* Applicants Table */}
      <Card>
        {filteredApplicants.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchTerm ? 'No applicants found' : 'No applicants yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm 
                ? 'Try adjusting your search terms' 
                : 'Get started by creating your first applicant'
              }
            </p>
            {!searchTerm && (
              <Button onClick={handleCreateApplicant}>
                Case Registration
              </Button>
            )}
          </div>
        ) : (
          <Table
            data={filteredApplicants}
            columns={columns}
            keyField="id"
          />
        )}
      </Card>

      {/* Create Applicant Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={handleCreateModalClose}
        title="Case Registration"
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Information Section */}
          <div className="mb-8">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h4 className="text-lg font-medium text-gray-900">Personal Information</h4>
              <p className="text-sm text-gray-600 mt-1">Basic personal details of the applicant</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Input
                  label="ITS Number"
                  required
                  error={errors.its_number?.message}
                  {...register('its_number', { 
                    required: 'ITS number is required',
                    pattern: {
                      value: /^[0-9]{8}$/,
                      message: 'ITS number must be exactly 8 digits'
                    },
                    minLength: {
                      value: 8,
                      message: 'ITS number must be exactly 8 digits'
                    },
                    maxLength: {
                      value: 8,
                      message: 'ITS number must be exactly 8 digits'
                    }
                  })}
                  placeholder="Enter 8-digit ITS number"
                  maxLength={8}
                  onKeyDown={handleCreateItsNumberKeyDown}
                />
                <p className="text-xs text-gray-500">Data will be automatically fetched as you type (minimum 3 characters) or press Enter</p>
                {isCreateFetchingFromApi && (
                  <div className="text-sm text-blue-600 flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Fetching data from API...
                  </div>
                )}
              </div>
              
              <Input
                label="Full Name"
                required
                error={errors.full_name?.message}
                {...register('full_name', { 
                  required: 'Full name is required',
                  pattern: {
                    value: /^[A-Za-z\s]+$/,
                    message: 'Full name can only contain alphabets and spaces'
                  },
                  minLength: {
                    value: 2,
                    message: 'Full name must be at least 2 characters'
                  },
                  maxLength: {
                    value: 250,
                    message: 'Full name must not exceed 250 characters'
                  }
                })}
                placeholder="Enter full name (alphabets only)"
                maxLength={250}
              />
              
              <Input
                label="Age"
                type="number"
                error={errors.age?.message}
                {...register('age', {
                  min: {
                    value: 0,
                    message: 'Age must be at least 0'
                  },
                  max: {
                    value: 999,
                    message: 'Age must be less than 1000'
                  },
                  validate: (value) => {
                    if (!value) return true; // Optional field
                    if (isNaN(value) || value < 0 || value > 999) {
                      return 'Please enter a valid age (0-999)';
                    }
                    if (value.toString().length > 3) {
                      return 'Age must be maximum 3 digits';
                    }
                    return true;
                  }
                })}
                placeholder="Enter age (max 3 digits)"
                maxLength={3}
              />
            </div>
            
            {/* Photo Preview (from API) */}
            {createPhotoPreview && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photo (from API)
                </label>
                <img 
                  src={createPhotoPreview} 
                  alt="Applicant" 
                  className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
                />
              </div>
            )}
          </div>

          {/* Demographics Section */}
          <div className="mb-8">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h4 className="text-lg font-medium text-gray-900">Demographics</h4>
              <p className="text-sm text-gray-600 mt-1">Gender and marital status information</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Gender"
                error={errors.gender?.message}
                {...register('gender')}
              >
                <Select.Option value="">Select gender</Select.Option>
                <Select.Option value="male">Male</Select.Option>
                <Select.Option value="female">Female</Select.Option>
              </Select>
              
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="mb-8">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h4 className="text-lg font-medium text-gray-900">Contact Information</h4>
              <p className="text-sm text-gray-600 mt-1">Phone and email contact details</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Phone"
                type="tel"
                error={errors.phone?.message}
                {...register('phone', {
                  pattern: {
                    value: /^[\+]?[1-9][\d]{0,15}$/,
                    message: 'Please enter a valid phone number'
                  }
                })}
                placeholder="Enter phone number"
              />
              
              <Input
                label="Email"
                type="email"
                error={errors.email?.message}
                {...register('email', {
                  pattern: {
                    value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                    message: 'Please enter a valid email address'
                  },
                  validate: (value) => {
                    if (!value) return true; // Optional field
                    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                    if (!emailRegex.test(value)) {
                      return 'Please enter a valid email address';
                    }
                    return true;
                  }
                })}
                placeholder="Enter email address"
              />
            </div>
          </div>

          {/* Address Information Section */}
          <div className="mb-8">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h4 className="text-lg font-medium text-gray-900">Address Information</h4>
              <p className="text-sm text-gray-600 mt-1">Complete address details</p>
            </div>
            
            <div className="space-y-4">
              <Input
                label="Address"
                error={errors.address?.message}
                {...register('address')}
                placeholder="Enter full address"
              />
              
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Jamiat"
                    {...register('jamiat_name')}
                    readOnly
                    className="bg-gray-50"
                    placeholder="Will be filled from API"
                  />
                  
                  <Input
                    label="Jamaat"
                    {...register('jamaat_name')}
                    readOnly
                    className="bg-gray-50"
                    placeholder="Will be filled from API"
                  />
                </div>
              
            </div>
          </div>

          {/* Case Information Section */}
          <div className="mb-8 border-t border-gray-200 pt-6">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h4 className="text-lg font-medium text-gray-900">Case Information</h4>
              <p className="text-sm text-gray-600 mt-1">Case details for the new applicant</p>
            </div>

            {/* Case Type */}
            <div className="mb-6">
              <Select
                label="Case Type"
                required
                error={errors.case_type_id?.message}
                {...register('case_type_id', { 
                  required: 'Please select a case type' 
                })}
              >
                <Select.Option value="">Select case type</Select.Option>
                {caseTypesData?.map((caseType) => (
                  <Select.Option key={caseType.id} value={caseType.id}>
                    {caseType.name}
                  </Select.Option>
                ))}
              </Select>
            </div>

            {/* Case Description */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Case Description
                <span className="text-red-500 ml-1">*</span>
              </label>
              <textarea
                {...register('description', { 
                  required: 'Please provide a case description' 
                })}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.description ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                }`}
                placeholder="Describe the case details, requirements, and any relevant information..."
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            {/* Additional Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Any additional notes or special instructions..."
              />
            </div>
          </div>

          {/* Error/Success Messages */}
          {createError && (
            <Alert severity="error" className="mb-4">
              {createError}
            </Alert>
          )}

          {createApiError && (
            <Alert severity="error" className="mb-4">
              {createApiError}
            </Alert>
          )}

          {createSuccess && (
            <Alert severity="success" className="mb-4">
              {createSuccess}
            </Alert>
          )}

          {/* Modal Footer */}
          <Modal.Footer>
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCreateModalClose}
                disabled={createApplicantMutation.isLoading || createCaseMutation.isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createApplicantMutation.isLoading || createCaseMutation.isLoading}
                disabled={createApplicantMutation.isLoading || createCaseMutation.isLoading}
              >
                {(createApplicantMutation.isLoading || createCaseMutation.isLoading) 
                  ? 'Creating Applicant & Case...' 
                  : 'Create Case'}
              </Button>
            </div>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Edit Applicant Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={handleEditModalClose}
        title="Edit Applicant"
        size="xl"
      >
        <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-6">
          {/* Personal Information Section */}
          <div className="mb-8">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h4 className="text-lg font-medium text-gray-900">Personal Information</h4>
              <p className="text-sm text-gray-600 mt-1">Basic personal details of the applicant</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Input
                  label="ITS Number"
                  required
                  error={editErrors.its_number?.message}
                  {...registerEdit('its_number', { 
                    required: 'ITS number is required',
                    pattern: {
                      value: /^[0-9]{8}$/,
                      message: 'ITS number must be exactly 8 digits'
                    },
                    minLength: {
                      value: 8,
                      message: 'ITS number must be exactly 8 digits'
                    },
                    maxLength: {
                      value: 8,
                      message: 'ITS number must be exactly 8 digits'
                    }
                  })}
                  placeholder="Enter 8-digit ITS number"
                  maxLength={8}
                  onKeyDown={handleEditItsNumberKeyDown}
                />
                <p className="text-xs text-gray-500">Data will be automatically fetched as you type (minimum 3 characters) or press Enter</p>
                {isEditFetchingFromApi && (
                  <div className="text-sm text-blue-600 flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Fetching data from API...
                  </div>
                )}
              </div>
              
              <Input
                label="Full Name"
                required
                error={editErrors.full_name?.message}
                {...registerEdit('full_name', { 
                  required: 'Full name is required',
                  pattern: {
                    value: /^[A-Za-z\s]+$/,
                    message: 'Full name can only contain alphabets and spaces'
                  },
                  minLength: {
                    value: 2,
                    message: 'Full name must be at least 2 characters'
                  },
                  maxLength: {
                    value: 250,
                    message: 'Full name must not exceed 250 characters'
                  }
                })}
                placeholder="Enter full name (alphabets only)"
                maxLength={250}
              />
              
              <Input
                label="Age"
                type="number"
                error={editErrors.age?.message}
                {...registerEdit('age', {
                  min: {
                    value: 0,
                    message: 'Age must be at least 0'
                  },
                  max: {
                    value: 999,
                    message: 'Age must be less than 1000'
                  },
                  validate: (value) => {
                    if (!value) return true; // Optional field
                    if (isNaN(value) || value < 0 || value > 999) {
                      return 'Please enter a valid age (0-999)';
                    }
                    if (value.toString().length > 3) {
                      return 'Age must be maximum 3 digits';
                    }
                    return true;
                  }
                })}
                placeholder="Enter age (max 3 digits)"
                maxLength={3}
              />
            </div>
            
            {/* Photo Preview (from API) */}
            {editPhotoPreview && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photo (from API)
                </label>
                <img 
                  src={editPhotoPreview} 
                  alt="Applicant" 
                  className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200"
                />
              </div>
            )}
          </div>

          {/* Demographics Section */}
          <div className="mb-8">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h4 className="text-lg font-medium text-gray-900">Demographics</h4>
              <p className="text-sm text-gray-600 mt-1">Gender and marital status information</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Gender"
                error={editErrors.gender?.message}
                {...registerEdit('gender')}
              >
                <Select.Option value="">Select gender</Select.Option>
                <Select.Option value="male">Male</Select.Option>
                <Select.Option value="female">Female</Select.Option>
              </Select>
              
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="mb-8">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h4 className="text-lg font-medium text-gray-900">Contact Information</h4>
              <p className="text-sm text-gray-600 mt-1">Phone and email contact details</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Phone"
                type="tel"
                error={editErrors.phone?.message}
                {...registerEdit('phone', {
                  pattern: {
                    value: /^[\+]?[1-9][\d]{0,15}$/,
                    message: 'Please enter a valid phone number'
                  }
                })}
                placeholder="Enter phone number"
              />
              
              <Input
                label="Email"
                type="email"
                error={editErrors.email?.message}
                {...registerEdit('email', {
                  pattern: {
                    value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                    message: 'Please enter a valid email address'
                  },
                  validate: (value) => {
                    if (!value) return true; // Optional field
                    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                    if (!emailRegex.test(value)) {
                      return 'Please enter a valid email address';
                    }
                    return true;
                  }
                })}
                placeholder="Enter email address"
              />
            </div>
          </div>

          {/* Address Information Section */}
          <div className="mb-8">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h4 className="text-lg font-medium text-gray-900">Address Information</h4>
              <p className="text-sm text-gray-600 mt-1">Complete address details</p>
            </div>
            
            <div className="space-y-4">
              <Input
                label="Address"
                error={editErrors.address?.message}
                {...registerEdit('address')}
                placeholder="Enter full address"
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Jamiat"
                  {...registerEdit('jamiat_name')}
                  readOnly
                  className="bg-gray-50"
                  placeholder="Will be filled from API"
                />
                
                <Input
                  label="Jamaat"
                  {...registerEdit('jamaat_name')}
                  readOnly
                  className="bg-gray-50"
                  placeholder="Will be filled from API"
                />
              </div>
              
            </div>
          </div>

          {/* Error/Success Messages */}
          {editError && (
            <Alert severity="error" className="mb-4">
              {editError}
            </Alert>
          )}

          {editApiError && (
            <Alert severity="error" className="mb-4">
              {editApiError}
            </Alert>
          )}

          {editSuccess && (
            <Alert severity="success" className="mb-4">
              {editSuccess}
            </Alert>
          )}

          {/* Modal Footer */}
          <Modal.Footer>
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleEditModalClose}
                disabled={updateApplicantMutation.isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={updateApplicantMutation.isLoading}
                disabled={updateApplicantMutation.isLoading}
              >
                {updateApplicantMutation.isLoading ? 'Updating...' : 'Update Applicant'}
              </Button>
            </div>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={handleCancelDelete}
        title="Delete Applicant"
        size="sm"
      >
        <div className="space-y-4">
          {deleteError && (
            <Alert variant="error" onClose={() => setDeleteError('')}>
              {deleteError}
            </Alert>
          )}

          <div className="text-center py-4">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Are you sure?
            </h3>
            
            {applicantToDelete && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  You are about to delete:
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {applicantToDelete.full_name}
                </p>
                <p className="text-xs text-gray-500">
                  ITS: {applicantToDelete.its_number}
                </p>
              </div>
            )}
            
            <p className="text-sm text-gray-600">
              This action cannot be undone. All data associated with this applicant will be permanently deleted.
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancelDelete}
              disabled={deleteApplicantMutation.isLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmDelete}
              loading={deleteApplicantMutation.isLoading}
              disabled={deleteApplicantMutation.isLoading}
            >
              {deleteApplicantMutation.isLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Applicants;