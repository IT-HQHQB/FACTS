import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'react-query';
import axios from 'axios';
import { 
  Button, 
  Input, 
  Card, 
  Select, 
  Alert 
} from '../components/ui';

const CreateApplicant = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [apiError, setApiError] = useState('');
  const [isFetchingFromApi, setIsFetchingFromApi] = useState(false);
  const [apiJamiatId, setApiJamiatId] = useState(null);
  const [apiJamaatId, setApiJamaatId] = useState(null);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm();
  const itsNumberRef = useRef(null);
  const [previousItsNumber, setPreviousItsNumber] = useState('');
  const [pendingJamaatId, setPendingJamaatId] = useState(null);

  // Watch for ITS number changes
  const watchedItsNumber = watch('its_number');

  // Effect to handle ITS number changes
  useEffect(() => {
    if (watchedItsNumber && watchedItsNumber !== previousItsNumber && watchedItsNumber.length >= 3) {
      // Add a small delay to avoid too frequent API calls
      const timer = setTimeout(() => {
        fetchFromApi(watchedItsNumber);
      }, 500);
      
      setPreviousItsNumber(watchedItsNumber);
      
      return () => clearTimeout(timer);
    }
  }, [watchedItsNumber, previousItsNumber]);

  // Set jamaat_id when jamaatData is loaded and we have a pending jamaat_id from API
  useEffect(() => {
    if (jamaatData && pendingJamaatId) {
      setValue('jamaat_id', pendingJamaatId);
      setPendingJamaatId(null);
    }
  }, [jamaatData, pendingJamaatId, setValue]);

  // Handle Enter key press on ITS number field
  const handleItsNumberKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const itsNumber = e.target.value.trim();
      if (itsNumber && itsNumber.length >= 3) {
        fetchFromApi(itsNumber);
      } else {
        setApiError('Please enter a valid ITS number (minimum 3 characters)');
      }
    }
  };

  // Fetch jamiat and jamaat data
  const { data: jamiatData } = useQuery(
    'jamiat',
    () => axios.get('/api/jamiat').then(res => res.data),
    {
      select: (data) => data.jamiat || [],
    }
  );

  const { data: jamaatData } = useQuery(
    'jamaat',
    () => axios.get('/api/jamaat').then(res => res.data),
    {
      select: (data) => data.jamaat || [],
    }
  );

  const createApplicantMutation = useMutation(
    (applicantData) => axios.post('/api/applicants', applicantData),
    {
      onSuccess: (response) => {
        setSuccess('Applicant created successfully!');
        setError('');
        reset();
        setTimeout(() => {
          navigate('/applicants');
        }, 1500);
      },
      onError: (error) => {
        setError(error.response?.data?.message || 'Failed to create applicant');
        setSuccess('');
      },
    }
  );

  // Function to fetch data from external API
  const fetchFromApi = async (itsNumber) => {
    if (!itsNumber || itsNumber.trim() === '') {
      return; // Don't fetch if ITS number is empty
    }

    setIsFetchingFromApi(true);
    setApiError('');

    try {
      const response = await axios.get(`/api/applicants/fetch-from-api/${itsNumber}`);
      const apiData = response.data.data;

      // Auto-fill form fields with API data
      if (apiData.full_name) {
        const nameParts = apiData.full_name.split(' ');
        setValue('first_name', nameParts[0] || '');
        setValue('last_name', nameParts.slice(1).join(' ') || '');
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
      if (apiData.address) {
        setValue('address', apiData.address);
      }
      if (apiData.city) {
        setValue('city', apiData.city);
      }
      if (apiData.state) {
        setValue('state', apiData.state);
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
        setApiJamiatId(apiData.jamiat_id);
      }
      if (apiData.jamaat_id) {
        setApiJamaatId(apiData.jamaat_id);
      }

      setSuccess('Data fetched successfully from external API!');
      setError('');
      
    } catch (error) {
      console.error('API fetch error:', error);
      setApiError(error.response?.data?.error || 'Failed to fetch data from external API');
    } finally {
      setIsFetchingFromApi(false);
    }
  };


  const onSubmit = (data) => {
    setError('');
    setSuccess('');
    setApiError('');
    
    const applicantData = {
      its_number: data.its_number,
      first_name: data.first_name,
      last_name: data.last_name,
      age: data.age,
      gender: data.gender,
      phone: data.phone,
      email: data.email,
      address: data.address,
      mauze: data.mauze,
      city: data.city,
      state: data.state,
      jamiat_name: data.jamiat_name,
      jamaat_name: data.jamaat_name,
      jamiat_id: apiJamiatId,
      jamaat_id: apiJamaatId
    };
    
    createApplicantMutation.mutate(applicantData);
  };

  const handleCancel = () => {
    navigate('/applicants');
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Applicant</h1>
        <p className="text-gray-600">Fill in the details to create a new applicant</p>
      </div>
      
      {/* Form */}
      <div className="max-w-4xl">
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="p-6">
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
                        value: /^[A-Za-z0-9]+$/,
                        message: 'ITS number should contain only letters and numbers'
                      }
                    })}
                    placeholder="Enter ITS number"
                      onKeyDown={handleItsNumberKeyDown}
                    />
                    <p className="text-xs text-gray-500">Data will be automatically fetched as you type (minimum 3 characters) or press Enter</p>
                    {isFetchingFromApi && (
                      <div className="text-sm text-blue-600 flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        Fetching data from API...
                      </div>
                    )}
                  </div>
                  
                  <Input
                    label="First Name"
                    required
                    error={errors.first_name?.message}
                    {...register('first_name', { 
                      required: 'First name is required',
                      minLength: {
                        value: 2,
                        message: 'First name must be at least 2 characters'
                      }
                    })}
                    placeholder="Enter first name"
                  />
                  
                  <Input
                    label="Last Name"
                    required
                    error={errors.last_name?.message}
                    {...register('last_name', { 
                      required: 'Last name is required',
                      minLength: {
                        value: 2,
                        message: 'Last name must be at least 2 characters'
                      }
                    })}
                    placeholder="Enter last name"
                  />
                  
                  <Input
                    label="Father's Name"
                    error={errors.father_name?.message}
                    {...register('father_name')}
                    placeholder="Enter father's name"
                  />
                  
                  <Input
                    label="Mother's Name"
                    error={errors.mother_name?.message}
                    {...register('mother_name')}
                    placeholder="Enter mother's name"
                  />
                  
                  <Input
                    label="Date of Birth"
                    type="date"
                    error={errors.date_of_birth?.message}
                    {...register('date_of_birth', {
                      validate: (value) => {
                        if (!value) return true; // Optional field
                        const today = new Date();
                        const birthDate = new Date(value);
                        const age = today.getFullYear() - birthDate.getFullYear();
                        if (age < 0 || age > 120) {
                          return 'Please enter a valid date of birth';
                        }
                        return true;
                      }
                    })}
                  />
                </div>
              </div>

              {/* Demographics Section */}
              <div className="mb-8">
                <div className="border-b border-gray-200 pb-4 mb-6">
                  <h4 className="text-lg font-medium text-gray-900">Demographics</h4>
                  <p className="text-sm text-gray-600 mt-1">Gender information</p>
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
                    <Select.Option value="other">Other</Select.Option>
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
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Please enter a valid email address'
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Mauze"
                      error={errors.mauze?.message}
                      {...register('mauze')}
                      placeholder="Enter mauze"
                    />
                    
                    <Input
                      label="City"
                      error={errors.city?.message}
                      {...register('city')}
                      placeholder="Enter city"
                    />
                    
                    <Input
                      label="State"
                      error={errors.state?.message}
                      {...register('state')}
                      placeholder="Enter state"
                    />
                  </div>
                  
                </div>
              </div>

              {/* Jamiat and Jamaat Information Section */}
              <div className="mb-8">
                <div className="border-b border-gray-200 pb-4 mb-6">
                  <h4 className="text-lg font-medium text-gray-900">Jamiat & Jamaat Information</h4>
                  <p className="text-sm text-gray-600 mt-1">Religious community affiliations</p>
                </div>
                
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

              {/* Error/Success Messages */}
              {error && (
                <Alert severity="error" className="mb-4">
                  {error}
                </Alert>
              )}

              {apiError && (
                <Alert severity="error" className="mb-4">
                  {apiError}
                </Alert>
              )}

              {success && (
                <Alert severity="success" className="mb-4">
                  {success}
                </Alert>
              )}

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={createApplicantMutation.isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={createApplicantMutation.isLoading}
                  disabled={createApplicantMutation.isLoading}
                >
                  {createApplicantMutation.isLoading ? 'Creating...' : 'Create Applicant'}
                </Button>
          </div>
        </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CreateApplicant;