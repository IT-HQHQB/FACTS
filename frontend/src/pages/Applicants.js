import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
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
  Select,
  Pagination
} from '../components/ui';

const Applicants = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
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
  const [editApiFetchedData, setEditApiFetchedData] = useState(null); // Store API-fetched data for update
  const [editDataRefreshedFromApi, setEditDataRefreshedFromApi] = useState(false); // Flag to track if data was refreshed
  
  // Photo preview state (from API)
  const [createPhotoPreview, setCreatePhotoPreview] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  
  // Delete confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [applicantToDelete, setApplicantToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  // Bulk import state
  const [bulkImportText, setBulkImportText] = useState('');
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState(null);
  const [bulkImportError, setBulkImportError] = useState('');
  
  // Bulk fetch state
  const [bulkFetchLoading, setBulkFetchLoading] = useState(false);
  const [bulkFetchResult, setBulkFetchResult] = useState(null);
  const [bulkFetchError, setBulkFetchError] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  
  // Excel import state
  const [excelFile, setExcelFile] = useState(null);
  const [excelImportLoading, setExcelImportLoading] = useState(false);
  const [excelImportResult, setExcelImportResult] = useState(null);
  const [excelImportError, setExcelImportError] = useState('');

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue, trigger } = useForm();
  const { register: registerEdit, handleSubmit: handleEditSubmit, formState: { errors: editErrors }, reset: resetEdit, watch: watchEdit, setValue: setEditValue, getValues: getEditValues } = useForm();
  
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

  // Fetch applicants with pagination
  const { data: applicantsData, isLoading, error, refetch } = useQuery(
    ['applicants', page, searchTerm, limit],
    () => axios.get('/api/applicants', {
      params: {
        page,
        limit,
        ...(searchTerm && { search: searchTerm }),
      },
    }).then(res => res.data),
    {
      keepPreviousData: true,
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

  // Reset page to 1 when search term or limit changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, limit]);

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

      // Store the fetched API data for use during update
      setEditApiFetchedData(apiData);
      setEditDataRefreshedFromApi(true);

      setEditSuccess('Data fetched successfully from external API!');
      setEditError('');
      
    } catch (error) {
      console.error('❌ EDIT - API fetch error:', error);
      setEditApiError(error.response?.data?.error || 'Failed to fetch data from external API');
      setEditApiFetchedData(null);
      setEditDataRefreshedFromApi(false);
    } finally {
      setIsEditFetchingFromApi(false);
    }
  };

  // Handle refresh details button click
  const handleRefreshDetails = async () => {
    if (!editingApplicant) {
      setEditApiError('No applicant selected');
      return;
    }

    // Get current ITS number from form
    const currentItsNumber = watchEdit('its_number');
    
    if (!currentItsNumber || currentItsNumber.trim().length < 3) {
      setEditApiError('Please enter a valid ITS number (minimum 3 characters)');
      return;
    }

    // Check if fields are missing or changed compared to original applicant data
    const currentFormData = {
      full_name: watchEdit('full_name'),
      age: watchEdit('age'),
      gender: watchEdit('gender'),
      phone: watchEdit('phone'),
      email: watchEdit('email'),
      address: watchEdit('address'),
      jamiat_name: watchEdit('jamiat_name'),
      jamaat_name: watchEdit('jamaat_name')
    };

    const originalData = {
      full_name: editingApplicant.full_name,
      age: editingApplicant.age,
      gender: editingApplicant.gender,
      phone: editingApplicant.phone || '',
      email: editingApplicant.email || '',
      address: editingApplicant.address || '',
      jamiat_name: editingApplicant.jamiat_name || '',
      jamaat_name: editingApplicant.jamaat_name || ''
    };

    // Check if any field is missing or changed
    const hasMissingFields = !currentFormData.full_name || !currentFormData.phone || !currentFormData.email;
    const hasChangedFields = 
      currentFormData.full_name !== originalData.full_name ||
      currentFormData.age !== originalData.age ||
      currentFormData.gender !== originalData.gender ||
      currentFormData.phone !== originalData.phone ||
      currentFormData.email !== originalData.email ||
      currentFormData.address !== originalData.address ||
      currentFormData.jamiat_name !== originalData.jamiat_name ||
      currentFormData.jamaat_name !== originalData.jamaat_name;

    // Always fetch from API when refresh button is clicked (user explicitly requested refresh)
    await fetchFromApiForEdit(currentItsNumber.trim());
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
      
      // Prepare case data for auto-creation
      const caseData = {
        case_type_id: data.case_type_id,
        roles: null,
        assigned_counselor_id: null,
        jamiat_id: createApiJamiatId || null,
        jamaat_id: createApiJamaatId || null,
        assigned_role: null,
        description: data.description,
        notes: data.notes || null
      };
      
      // Create applicant with case_data - backend will auto-create case
      const requestData = {
        ...applicantData,
        case_data: caseData // Send case data for auto-creation
      };
      
      console.log('💾 Creating applicant with case data (bidirectional creation):', {
        ...requestData,
        photo: requestData.photo ? `Photo included (${(requestData.photo.length / 1024).toFixed(2)} KB)` : 'NO PHOTO'
      });
      
      // Create applicant - backend will auto-create case if case_data is provided
      const applicantResponse = await axios.post('/api/applicants', requestData);
      
      if (!applicantResponse.data.applicantId) {
        throw new Error('Failed to get applicant ID from response');
      }
      
      console.log('✅ Applicant created successfully with ID:', applicantResponse.data.applicantId);
      
      if (applicantResponse.data.caseId) {
        console.log('✅ Case auto-created successfully with ID:', applicantResponse.data.caseId);
        // Refresh the applicants list
        queryClient.invalidateQueries(['applicants']);
        // If we have a case ID, we could navigate to the case, but for now just show success
        setCreateSuccess('Applicant and case created successfully!');
      } else {
        setCreateSuccess('Applicant created successfully!');
      }
      
      // Reset form
      reset();
      setCreateModalOpen(false);
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
      
      // Explicitly get jamaat_name and jamiat_name from form state to ensure read-only field is captured
      // Try getValues first (for read-only fields), then form data, then API fetched data as fallback
      const jamaatName = getEditValues('jamaat_name') || data.jamaat_name || editApiFetchedData?.jamaat_name || '';
      const jamiatName = getEditValues('jamiat_name') || data.jamiat_name || editApiFetchedData?.jamiat_name || '';
      
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
        jamiat_name: jamiatName,
        jamaat_name: jamaatName,
        jamiat_id: editApiJamiatId,
        jamaat_id: editApiJamaatId,
        refresh_from_api: editDataRefreshedFromApi // Flag to indicate data was refreshed from API
      };
      
      // Update applicant
      await axios.put(`/api/applicants/${editingApplicant.id}`, applicantData);
      
      // Reset refresh flag after update
      setEditDataRefreshedFromApi(false);
      setEditApiFetchedData(null);
      
      setEditSuccess('Applicant updated successfully!');
      resetEdit();
      setEditPhotoPreview(null);
      setEditModalOpen(false);
      setEditingApplicant(null);
      setEditDataRefreshedFromApi(false);
      setEditApiFetchedData(null);
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
    setEditDataRefreshedFromApi(false);
    setEditApiFetchedData(null);
    resetEdit();
  };

  // Bulk import function
  const handleBulkImport = async () => {
    if (!bulkImportText.trim()) {
      setBulkImportError('Please enter ITS numbers');
      return;
    }

    setBulkImportLoading(true);
    setBulkImportError('');
    setBulkImportResult(null);

    try {
      // Parse ITS numbers from text (split by newline, comma, or space)
      const itsNumbers = bulkImportText
        .split(/[\n,\s]+/)
        .map(num => num.trim())
        .filter(num => num.length > 0);

      if (itsNumbers.length === 0) {
        setBulkImportError('No valid ITS numbers found');
        setBulkImportLoading(false);
        return;
      }

      const response = await axios.post('/api/applicants/bulk-import', {
        its_numbers: itsNumbers
      });

      setBulkImportResult(response.data.summary);
      setBulkImportText('');
      refetch();
      
      // Refresh pending count
      fetchPendingCount();
    } catch (error) {
      setBulkImportError(error.response?.data?.error || 'Failed to import ITS numbers');
    } finally {
      setBulkImportLoading(false);
    }
  };

  // Bulk fetch function
  const handleBulkFetch = async () => {
    setBulkFetchLoading(true);
    setBulkFetchError('');
    setBulkFetchResult(null);

    try {
      const response = await axios.post('/api/applicants/bulk-fetch');
      setBulkFetchResult(response.data.summary);
      refetch();
      
      // Refresh pending count
      fetchPendingCount();
    } catch (error) {
      setBulkFetchError(error.response?.data?.error || 'Failed to fetch details from API');
    } finally {
      setBulkFetchLoading(false);
    }
  };

  // Fetch pending count
  const fetchPendingCount = async () => {
    try {
      const response = await axios.get('/api/applicants/meta/pending-count');
      setPendingCount(response.data.pendingCount);
    } catch (error) {
      console.error('Error fetching pending count:', error);
    }
  };

  // Excel import function
  const handleExcelImport = async () => {
    if (!excelFile) {
      setExcelImportError('Please select an Excel file');
      return;
    }

    setExcelImportLoading(true);
    setExcelImportError('');
    setExcelImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', excelFile);

      const response = await axios.post('/api/applicants/import-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setExcelImportResult(response.data.summary);
      setExcelFile(null);
      refetch();
      
      // Refresh pending count
      fetchPendingCount();
    } catch (error) {
      setExcelImportError(error.response?.data?.error || 'Failed to import Excel file');
    } finally {
      setExcelImportLoading(false);
    }
  };

  // Download sample Excel template
  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get('/api/applicants/export-template', {
        responseType: 'blob',
        validateStatus: (status) => status < 500 // Don't throw for 4xx, we'll handle it
      });

      // Check if response status indicates an error (4xx or 5xx)
      if (response.status >= 400) {
        // Error response - try to parse as JSON
        let errorText = '';
        try {
          errorText = await response.data.text();
          const jsonError = JSON.parse(errorText);
          throw new Error(jsonError.error || 'Failed to download template');
        } catch (parseError) {
          // If parsing fails, use status-based message
          let errorMessage = 'Failed to download template';
          if (response.status === 401) {
            errorMessage = 'Authentication required. Please log in again.';
          } else if (response.status === 403) {
            errorMessage = 'You do not have permission to download the template.';
          } else if (response.status === 404) {
            errorMessage = 'Template not found.';
          } else if (response.status >= 500) {
            errorMessage = 'Server error. Please try again later.';
          }
          throw new Error(errorMessage);
        }
      }

      // Check content type to ensure it's an Excel file
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('spreadsheet') && !contentType.includes('excel') && !contentType.includes('application/vnd.openxmlformats')) {
        // Might be a JSON error response disguised as blob
        try {
          const text = await response.data.text();
          const jsonError = JSON.parse(text);
          throw new Error(jsonError.error || 'Invalid file format received');
        } catch (parseError) {
          // If parsing fails, it might still be a valid blob, proceed with download
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'its_numbers_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      
      let errorMessage = 'Failed to download template';
      
      if (error.response) {
        // Handle error response - axios converts error responses to blobs when responseType is 'blob'
        if (error.response.data instanceof Blob) {
          try {
            const text = await error.response.data.text();
            const jsonError = JSON.parse(text);
            errorMessage = jsonError.error || errorMessage;
          } catch (parseError) {
            // If it's not JSON, check status code
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
        } else if (error.response.status === 401) {
          errorMessage = 'Authentication required. Please log in again.';
        } else if (error.response.status === 403) {
          errorMessage = 'You do not have permission to download the template.';
        } else if (error.response.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    }
  };

  // Fetch pending count on mount and after refetch
  useEffect(() => {
    fetchPendingCount();
  }, []);

  // Update pending count when applicants data changes (as fallback)
  // Note: This is a fallback calculation on current page only, server count is preferred
  useEffect(() => {
    if (applicantsData?.applicants) {
      const pending = applicantsData.applicants.filter(
        applicant => !applicant.full_name || !applicant.phone || !applicant.email
      ).length;
      // Update as fallback (server count is preferred)
      setPendingCount(pending);
    }
  }, [applicantsData]);



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

      {/* Bulk Import Section */}
      <Card className="mb-6">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Bulk Import & API Fetch</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Bulk Import from Text */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Import ITS Numbers (one per line or comma-separated)
                </label>
                <textarea
                  value={bulkImportText}
                  onChange={(e) => setBulkImportText(e.target.value)}
                  placeholder="Enter ITS numbers, one per line or separated by commas..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={6}
                  disabled={bulkImportLoading}
                />
              </div>
              <Button
                onClick={handleBulkImport}
                disabled={bulkImportLoading || !bulkImportText.trim()}
                loading={bulkImportLoading}
                className="w-full"
              >
                {bulkImportLoading ? 'Importing...' : 'Bulk Import'}
              </Button>
              {bulkImportError && (
                <Alert variant="error" onClose={() => setBulkImportError('')}>
                  {bulkImportError}
                </Alert>
              )}
              {bulkImportResult && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">
                    <strong>Import Complete:</strong> {bulkImportResult.inserted} inserted, {bulkImportResult.skipped} skipped
                    {bulkImportResult.errors && bulkImportResult.errors.length > 0 && (
                      <span className="block mt-1 text-red-600">
                        {bulkImportResult.errors.length} error(s) occurred
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Excel Import */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Import from Excel File
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setExcelFile(e.target.files[0])}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    disabled={excelImportLoading}
                  />
                  <Button
                    variant="secondary"
                    onClick={handleDownloadTemplate}
                    disabled={excelImportLoading}
                  >
                    Download Sample
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Download sample Excel template to see the required format
                </p>
              </div>
              <Button
                onClick={handleExcelImport}
                disabled={excelImportLoading || !excelFile}
                loading={excelImportLoading}
                className="w-full"
              >
                {excelImportLoading ? 'Importing...' : 'Import from Excel'}
              </Button>
              {excelImportError && (
                <Alert variant="error" onClose={() => setExcelImportError('')}>
                  {excelImportError}
                </Alert>
              )}
              {excelImportResult && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">
                    <strong>Import Complete:</strong> {excelImportResult.inserted} inserted, {excelImportResult.skipped} skipped
                    {excelImportResult.errors && excelImportResult.errors.length > 0 && (
                      <span className="block mt-1 text-red-600">
                        {excelImportResult.errors.length} error(s) occurred
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bulk Fetch Section */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Fetch Details from API</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Fetches remaining details (photo, name, contact, etc.) for up to 30 pending applicants.
                  Rate limit: 20 requests per 3 minutes.
                </p>
                {pendingCount > 0 && (
                  <p className="text-sm text-blue-600 mt-1">
                    {pendingCount} applicant(s) pending data fetch
                  </p>
                )}
              </div>
              <Button
                onClick={handleBulkFetch}
                disabled={bulkFetchLoading || pendingCount === 0}
                loading={bulkFetchLoading}
                variant="primary"
              >
                {bulkFetchLoading ? 'Fetching...' : 'Fetch Details from API'}
              </Button>
            </div>
            {bulkFetchError && (
              <Alert variant="error" onClose={() => setBulkFetchError('')}>
                {bulkFetchError}
              </Alert>
            )}
            {bulkFetchResult && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Fetch Complete:</strong> {bulkFetchResult.fetched} fetched, {bulkFetchResult.failed} failed
                  {bulkFetchResult.errors && bulkFetchResult.errors.length > 0 && (
                    <span className="block mt-1 text-red-600">
                      {bulkFetchResult.errors.length} error(s) occurred
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

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
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700 whitespace-nowrap">Rows per page:</label>
              <Select
                value={limit.toString()}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-32"
              >
                <Select.Option value="20">20</Select.Option>
                <Select.Option value="50">50</Select.Option>
                <Select.Option value="100">100</Select.Option>
                <Select.Option value="500">500</Select.Option>
                <Select.Option value="1500">1500</Select.Option>
                <Select.Option value="2000">2000</Select.Option>
                <Select.Option value="2500">2500</Select.Option>
              </Select>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            {applicantsData?.pagination ? (
              <>Showing {((applicantsData.pagination.page - 1) * applicantsData.pagination.limit) + 1} to {Math.min(applicantsData.pagination.page * applicantsData.pagination.limit, applicantsData.pagination.total)} of {applicantsData.pagination.total} applicants</>
            ) : (
              <>0 applicants</>
            )}
          </div>
        </div>
      </div>

      {/* Applicants Table */}
      <Card>
        {(!applicantsData?.applicants || applicantsData.applicants.length === 0) ? (
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
          <>
            <Table
              data={applicantsData.applicants}
              columns={columns}
              keyField="id"
            />
            {/* Pagination */}
            {applicantsData?.pagination?.pages > 1 && (
              <div className="mt-6">
                <Pagination
                  currentPage={page}
                  totalPages={applicantsData.pagination.pages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
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
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleRefreshDetails}
                  disabled={isEditFetchingFromApi || !watchEdit('its_number') || watchEdit('its_number').trim().length < 3}
                  loading={isEditFetchingFromApi}
                  className="mt-2"
                >
                  {isEditFetchingFromApi ? 'Refreshing...' : 'Refresh Details'}
                </Button>
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