import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'react-query';
import axios from 'axios';
import { 
  Button, 
  Input, 
  Card, 
  Select, 
  Alert,
  Switch
} from '../components/ui';

const CreateCase = () => {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createNewApplicant, setCreateNewApplicant] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm();

  // Fetch applicants for the dropdown
  const { data: applicantsData } = useQuery(
    'applicants',
    () => axios.get('/api/applicants').then(res => res.data),
    {
      select: (data) => data.applicants || [],
    }
  );

  // Fetch users for assignment dropdown
  const { data: usersData } = useQuery(
    'users',
    () => axios.get('/api/users').then(res => res.data),
    {
      select: (data) => data.users || [],
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

  // Fetch priorities
  const { data: prioritiesData } = useQuery(
    'priorities',
    () => axios.get('/api/priorities').then(res => res.data),
    {
      select: (data) => data.priorities || [],
    }
  );

  const createApplicantMutation = useMutation(
    (applicantData) => axios.post('/api/applicants', applicantData),
    {
      onError: (error) => {
        setError(error.response?.data?.message || 'Failed to create applicant');
        setSuccess('');
      },
    }
  );

  const createCaseMutation = useMutation(
    (caseData) => axios.post('/api/cases', caseData),
    {
      onSuccess: (response) => {
        setSuccess('Case created successfully!');
        setError('');
        reset();
        setTimeout(() => {
          navigate(`/cases/${response.data.case.id}`);
        }, 1500);
      },
      onError: (error) => {
        setError(error.response?.data?.message || 'Failed to create case');
        setSuccess('');
      },
    }
  );

  const onSubmit = async (data) => {
    setError('');
    setSuccess('');

    try {
      let applicantId = data.applicant_id;

      // If creating a new applicant, create it first
      if (createNewApplicant) {
        const applicantData = {
          its_number: data.its_number,
          first_name: data.first_name,
          last_name: data.last_name,
          father_name: data.father_name,
          mother_name: data.mother_name,
          date_of_birth: data.date_of_birth,
          gender: data.gender,
          marital_status: data.marital_status,
          phone: data.phone,
          email: data.email,
          address: data.address,
          mauze: data.mauze,
          city: data.city,
          state: data.state,
          postal_code: data.postal_code
        };

        const applicantResponse = await createApplicantMutation.mutateAsync(applicantData);
        applicantId = applicantResponse.data.applicantId;
      }

      // Create the case with the applicant ID
      const caseData = {
        applicant_id: applicantId,
        case_type_id: data.case_type_id,
        priority_id: data.priority_id,
        assigned_to: data.assigned_to || null,
        description: data.description,
        notes: data.notes || null
      };

      createCaseMutation.mutate(caseData);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create case');
    }
  };

  const handleCancel = () => {
    navigate('/cases');
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Case</h1>
        <p className="text-gray-600">Fill in the details to create a new case</p>
      </div>

      {/* Form */}
      <div className="max-w-4xl">
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="p-6">
              {/* Toggle between existing and new applicant */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Applicant Selection</h3>
                    <p className="text-sm text-gray-600">
                      {createNewApplicant ? 'Create a new applicant' : 'Select an existing applicant'}
                    </p>
                  </div>
                  <Switch
                    checked={createNewApplicant}
                    onChange={setCreateNewApplicant}
                    label={createNewApplicant ? 'New Applicant' : 'Existing Applicant'}
                  />
                </div>
              </div>

              {!createNewApplicant ? (
                /* Existing Applicant Selection */
                <div className="mb-6">
                  <Select
                    label="Applicant"
                    required
                    error={errors.applicant_id?.message}
                    {...register('applicant_id', { 
                      required: !createNewApplicant ? 'Please select an applicant' : false
                    })}
                  >
                    <Select.Option value="">Select an applicant</Select.Option>
                    {applicantsData?.map((applicant) => (
                      <Select.Option key={applicant.id} value={applicant.id}>
                        {applicant.first_name} {applicant.last_name} - {applicant.email}
                      </Select.Option>
                    ))}
                  </Select>
                </div>
              ) : (
                /* New Applicant Form Fields */
                <div className="mb-6 space-y-6">
                  <div className="border-b border-gray-200 pb-4">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Applicant Information</h4>
                  </div>
                  
                  {/* Personal Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="ITS Number"
                      required
                      error={errors.its_number?.message}
                      {...register('its_number', { 
                        required: createNewApplicant ? 'ITS number is required' : false
                      })}
                      placeholder="Enter ITS number"
                    />
                    
                    <Input
                      label="First Name"
                      required
                      error={errors.first_name?.message}
                      {...register('first_name', { 
                        required: createNewApplicant ? 'First name is required' : false
                      })}
                      placeholder="Enter first name"
                    />
                    
                    <Input
                      label="Last Name"
                      required
                      error={errors.last_name?.message}
                      {...register('last_name', { 
                        required: createNewApplicant ? 'Last name is required' : false
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
                      {...register('date_of_birth')}
                    />
                  </div>

                  {/* Gender and Marital Status */}
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
                    
                    <Select
                      label="Marital Status"
                      error={errors.marital_status?.message}
                      {...register('marital_status')}
                    >
                      <Select.Option value="">Select marital status</Select.Option>
                      <Select.Option value="single">Single</Select.Option>
                      <Select.Option value="married">Married</Select.Option>
                      <Select.Option value="divorced">Divorced</Select.Option>
                      <Select.Option value="widowed">Widowed</Select.Option>
                    </Select>
                  </div>

                  {/* Contact Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Phone"
                      type="tel"
                      error={errors.phone?.message}
                      {...register('phone')}
                      placeholder="Enter phone number"
                    />
                    
                    <Input
                      label="Email"
                      type="email"
                      error={errors.email?.message}
                      {...register('email')}
                      placeholder="Enter email address"
                    />
                  </div>

                  {/* Address Information */}
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
                    
                    <Input
                      label="Postal Code"
                      error={errors.postal_code?.message}
                      {...register('postal_code')}
                      placeholder="Enter postal code"
                    />
                  </div>
                </div>
              )}

              {/* Case Information Section */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <div className="border-b border-gray-200 pb-4 mb-6">
                  <h4 className="text-md font-medium text-gray-900">Case Information</h4>
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

              {/* Priority */}
              <div className="mb-6">
                <Select
                  label="Priority"
                  required
                  error={errors.priority_id?.message}
                  {...register('priority_id', { 
                    required: 'Please select a priority level' 
                  })}
                >
                  <Select.Option value="">Select priority</Select.Option>
                  {prioritiesData?.map((priority) => (
                    <Select.Option key={priority.id} value={priority.id}>
                      {priority.name}
                    </Select.Option>
                  ))}
                </Select>
              </div>

              {/* Assigned To */}
              <div className="mb-6">
                <Select
                  label="Assign To"
                  error={errors.assigned_to?.message}
                  {...register('assigned_to')}
                >
                  <Select.Option value="">Unassigned</Select.Option>
                  {usersData?.filter(user => ['dcm', 'counselor', 'admin'].includes(user.role))
                    .map((user) => (
                    <Select.Option key={user.id} value={user.id}>
                      {user.full_name || user.username} ({user.role})
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
              {error && (
                <Alert severity="error" className="mb-4">
                  {error}
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
                  disabled={createCaseMutation.isLoading || createApplicantMutation.isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={createCaseMutation.isLoading || createApplicantMutation.isLoading}
                  disabled={createCaseMutation.isLoading || createApplicantMutation.isLoading}
                >
                  {(createCaseMutation.isLoading || createApplicantMutation.isLoading) 
                    ? (createNewApplicant ? 'Creating Applicant & Case...' : 'Creating Case...') 
                    : 'Create Case'}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CreateCase;